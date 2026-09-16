import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ANONYMIZED_MARKER,
  auditRetentionCutoff,
  emailLogRetentionCutoff,
  requestRetentionCutoff,
} from "@/lib/retention/cutoffs";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";
import { RETENTION_LAST_RUN_KEY, getSettings } from "./settings.service";

// F-AUD-08 — งานเก็บรักษาข้อมูลตาม PDPA (spec ข้อ 4.5)
// - คำขอที่พ้นระยะเก็บ: ลบข้อมูลส่วนบุคคล (คีย์ค้นหา IP เบราว์เซอร์ หมายเหตุ ลิงก์ผล) + ลบ snapshot และโน้ตภายใน
//   แต่คงแถวคำขอไว้ (เลขอ้างอิง สถานะ วันที่ หน่วยงาน) เพื่อให้รายงานสถิติย้อนหลังยังถูกต้อง
// - audit log ที่พ้นระยะเก็บ: ลบทิ้ง
// - ประวัติอีเมลที่พ้นระยะเก็บ: ลบทิ้ง (payload มีชื่อและวุฒิของผู้ถูกตรวจสอบ)

const BATCH_SIZE = 500;
const MAX_BATCHES = 200;

export type RetentionRun = {
  at: string;
  anonymized: number;
  auditDeleted: number;
  emailDeleted: number;
  trigger: "cron" | "manual";
};

function dueRequests(cutoff: Date): Prisma.VerificationRequestWhereInput {
  return {
    anonymizedAt: null,
    OR: [{ decidedAt: { lt: cutoff } }, { decidedAt: null, createdAt: { lt: cutoff } }],
  };
}

function parseLastRun(value: unknown): RetentionRun | null {
  const run = value as Partial<RetentionRun> | null;
  return run && typeof run.at === "string" ? (run as RetentionRun) : null;
}

export async function getRetentionOverview(now: Date = new Date()) {
  const settings = await getSettings();
  const [due, anonymizedTotal, auditDue, emailDue, lastRun] = await Promise.all([
    prisma.verificationRequest.count({
      where: dueRequests(requestRetentionCutoff(now, settings.retentionDays)),
    }),
    prisma.verificationRequest.count({ where: { anonymizedAt: { not: null } } }),
    prisma.auditLog.count({
      where: { createdAt: { lt: auditRetentionCutoff(now, settings.auditRetentionYears) } },
    }),
    prisma.emailLog.count({
      where: { createdAt: { lt: emailLogRetentionCutoff(now, settings.emailLogRetentionDays) } },
    }),
    prisma.appSetting.findUnique({ where: { key: RETENTION_LAST_RUN_KEY } }),
  ]);
  return {
    due,
    anonymizedTotal,
    auditDue,
    emailDue,
    lastRun: parseLastRun(lastRun?.value ?? null),
  };
}

export async function runRetention(
  { actorId, context }: { actorId: string | null; context?: RequestContext },
  now: Date = new Date(),
): Promise<RetentionRun> {
  const settings = await getSettings();
  const cutoff = requestRetentionCutoff(now, settings.retentionDays);

  let anonymized = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch = await prisma.verificationRequest.findMany({
      where: dueRequests(cutoff),
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;

    const ids = batch.map((row) => row.id);
    await prisma.$transaction([
      // trigger กันแก้ snapshot อนุญาตให้ลบ (ห้ามเฉพาะ UPDATE)
      prisma.verificationResult.deleteMany({ where: { requestId: { in: ids } } }),
      prisma.requestNote.deleteMany({ where: { requestId: { in: ids } } }),
      prisma.verificationRequest.updateMany({
        where: { id: { in: ids } },
        data: {
          searchValueHash: ANONYMIZED_MARKER,
          searchValueEnc: "",
          requesterReference: null,
          note: null,
          rejectDetail: null,
          ipAddress: null,
          userAgent: null,
          matchedStudentId: null,
          accessTokenHash: null,
          accessTokenEnc: null,
          expiresAt: null,
          anonymizedAt: now,
        },
      }),
    ]);
    anonymized += ids.length;
  }

  const { count: auditDeleted } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: auditRetentionCutoff(now, settings.auditRetentionYears) } },
  });

  const { count: emailDeleted } = await prisma.emailLog.deleteMany({
    where: { createdAt: { lt: emailLogRetentionCutoff(now, settings.emailLogRetentionDays) } },
  });

  const run: RetentionRun = {
    at: now.toISOString(),
    anonymized,
    auditDeleted,
    emailDeleted,
    trigger: actorId ? "manual" : "cron",
  };
  await prisma.appSetting.upsert({
    where: { key: RETENTION_LAST_RUN_KEY },
    create: { key: RETENTION_LAST_RUN_KEY, value: run },
    update: { value: run },
  });
  writeAuditLog({
    action: AuditAction.RETENTION_RUN,
    actorId,
    entityType: "AppSetting",
    metadata: {
      ...run,
      retentionDays: settings.retentionDays,
      auditYears: settings.auditRetentionYears,
      emailLogDays: settings.emailLogRetentionDays,
    },
    context,
  });
  return run;
}
