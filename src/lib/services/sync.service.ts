import "server-only";
import { Prisma, type SyncJob } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  type RegistryClient,
  RegistryError,
  type RegistryErrorCode,
  getRegistryClient,
} from "@/lib/integrations/registry";
import { REGISTRY_ERROR_CODES } from "@/lib/integrations/registry/errors";
import {
  hasSourceChanged,
  sourceFingerprint,
  toStudentRow,
} from "@/lib/integrations/registry/mapper";
import type { SyncStudent } from "@/lib/integrations/registry/types";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";
import { notifySyncFailed } from "./notification.service";

// F-DATA-06 / F-DATA-09 — sync ข้อมูลระบบทะเบียนลงตาราง Student (spec ข้อ 4.6)
// FULL = ทุกระเบียน · INCREMENTAL = เฉพาะที่เปลี่ยนหลัง sync สำเร็จครั้งก่อน · SINGLE = รายคนตามที่เจ้าหน้าที่กด

export type BulkSyncType = "FULL" | "INCREMENTAL";
export type SyncErrorCode = RegistryErrorCode | "NOT_FOUND" | "STALE" | "INTERNAL";

const SYNC_ERROR_CODES: readonly string[] = [
  ...REGISTRY_ERROR_CODES,
  "NOT_FOUND",
  "STALE",
  "INTERNAL",
];

// errorCode ในฐานข้อมูลเป็น string อิสระ — แปลงเป็นรหัสที่มีคำแปลเสมอ
export function normalizeSyncErrorCode(code: string | null): SyncErrorCode {
  return code && SYNC_ERROR_CODES.includes(code) ? (code as SyncErrorCode) : "INTERNAL";
}

const BULK_TYPES: BulkSyncType[] = ["FULL", "INCREMENTAL"];
const BULK_RUN_LOCK = "registry-bulk-sync";
const STALE_AFTER_MS = 60 * 60 * 1000;
const MAX_PAGES = 10_000;
export const SYNC_HISTORY_PAGE_SIZE = 20;

type Actor = { actorId: string | null; context?: RequestContext };

function pageSize(): number {
  const value = Number(process.env.SYNC_PAGE_SIZE ?? 500);
  return Number.isInteger(value) && value > 0 && value <= 1000 ? value : 500;
}

function describeError(error: unknown): { errorCode: SyncErrorCode; errorMessage: string } {
  if (error instanceof RegistryError) {
    return {
      errorCode: error.code,
      errorMessage: `${error.message} (attempts: ${error.attempts})`,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { errorCode: "INTERNAL", errorMessage: message.slice(0, 500) };
}

// งานที่โปรเซสตายกลางคัน (เช่น container รีสตาร์ต) จะถือ lock ค้างไว้ — ปลดให้เมื่อไม่มีความคืบหน้าเกินเวลา
// ดูจาก updatedAt ไม่ใช่ startedAt: sync ครั้งแรกของ Keystone ดึงรายละเอียดรายคนหลายพันครั้ง อาจนานเกิน 1 ชั่วโมง
async function releaseStaleLock(now = new Date()) {
  await prisma.syncJob.updateMany({
    where: { runLock: BULK_RUN_LOCK, updatedAt: { lt: new Date(now.getTime() - STALE_AFTER_MS) } },
    data: {
      runLock: null,
      status: "FAILED",
      errorCode: "STALE",
      errorMessage: "งานค้างเกินเวลาที่กำหนด",
      finishedAt: now,
    },
  });
}

export type StartBulkSyncResult =
  { ok: true; job: SyncJob } | { ok: false; code: "alreadyRunning" };

// แยก "เริ่มงาน" ออกจาก "ทำงาน" เพื่อให้ผู้เรียกตอบกลับทันทีพร้อม jobId แล้วรันต่อใน after()
export async function startBulkSync(
  type: BulkSyncType,
  { actorId, context }: Actor,
): Promise<StartBulkSyncResult> {
  await releaseStaleLock();

  let job: SyncJob;
  try {
    job = await prisma.syncJob.create({
      data: { type, runLock: BULK_RUN_LOCK, triggeredById: actorId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, code: "alreadyRunning" };
    }
    throw error;
  }

  writeAuditLog({
    action: AuditAction.SYNC_STARTED,
    actorId,
    entityType: "SyncJob",
    entityId: job.id,
    metadata: { type, source: actorId ? "manual" : "cron" },
    context,
  });
  return { ok: true, job };
}

async function lastSuccessfulBulkStart(excludeJobId: string): Promise<Date | undefined> {
  const last = await prisma.syncJob.findFirst({
    where: { id: { not: excludeJobId }, type: { in: BULK_TYPES }, status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  return last?.startedAt;
}

// เติมรายละเอียดที่รายการแบบชุดไม่มี (Keystone: ชื่อไทย + GPAX) เฉพาะผู้สำเร็จการศึกษา — ข้อมูลที่ใช้แสดงผลตรวจสอบวุฒิ
// BAD_RESPONSE / ไม่พบ → เก็บข้อมูลพื้นฐานไว้ (detailSyncedAt = null ไม่อนุมัติอัตโนมัติ) แล้วลองใหม่รอบหน้า
// timeout / เชื่อมต่อไม่ได้ → โยนต่อให้งานล้ม ไม่ยิงซ้ำอีกหลายพันครั้ง
async function withDetail(client: RegistryClient, student: SyncStudent): Promise<SyncStudent> {
  if (!client.enrichStudent || student.detailComplete !== false || student.status !== "GRADUATED") {
    return student;
  }
  try {
    return await client.enrichStudent(student);
  } catch (error) {
    if (error instanceof RegistryError && error.code === "BAD_RESPONSE") {
      console.warn("[sync] ดึงรายละเอียดรายคนไม่สำเร็จ", student.studentCode, error.message);
      return student;
    }
    throw error;
  }
}

async function upsertChanged(
  client: RegistryClient,
  students: SyncStudent[],
  syncedAt: Date,
): Promise<number> {
  if (students.length === 0) return 0;

  const codes = students.map((s) => s.studentCode);
  const stored = await prisma.student.findMany({
    where: { studentCode: { in: codes } },
    select: { studentCode: true, sourceHash: true, detailSyncedAt: true },
  });
  const storedBy = new Map(stored.map((s) => [s.studentCode, s]));

  const rows: ReturnType<typeof toStudentRow>[] = [];
  const unchangedCodes: string[] = [];
  for (const student of students) {
    const previous = storedBy.get(student.studentCode);
    const fingerprint = sourceFingerprint(student);
    const changed = hasSourceChanged(previous?.sourceHash, fingerprint);
    // ระเบียนเดิมที่ยังขาดรายละเอียด (รอบก่อนดึงไม่สำเร็จ) ลองใหม่แม้ข้อมูลพื้นฐานไม่เปลี่ยน
    const missingDetail =
      student.detailComplete === false &&
      student.status === "GRADUATED" &&
      !previous?.detailSyncedAt;
    if (!changed && !missingDetail) {
      unchangedCodes.push(student.studentCode);
      continue;
    }
    rows.push(toStudentRow(await withDetail(client, student), syncedAt, fingerprint));
  }

  await prisma.$transaction([
    ...rows.map((row) =>
      prisma.student.upsert({
        where: { studentCode: row.studentCode },
        create: row,
        update: row,
      }),
    ),
    prisma.student.updateMany({
      where: { studentCode: { in: unchangedCodes } },
      data: { syncedAt },
    }),
  ]);
  return rows.length;
}

// Keystone ส่งชื่อไทยของคณะ/หลักสูตร/วุฒิเฉพาะผู้สำเร็จการศึกษา (StudentAcademicRecord) — ระเบียนอื่นเก็บชื่ออังกฤษไว้ในช่องไทย
// เติมชื่อไทยจากคู่ชื่อ อังกฤษ → ไทย ที่พบในผู้สำเร็จการศึกษา (ชื่ออังกฤษต้องตรงกันทุกตัวอักษร เลือกคู่ที่พบบ่อยสุด)
// ไม่กระทบ sourceHash (คำนวณจากข้อมูลต้นทาง) · sync รอบหน้าที่เขียนทับด้วยชื่ออังกฤษจะถูกเติมใหม่หลังจบรอบ
const LOCALIZED_NAME_COLUMNS = [
  ["facultyTh", "facultyEn"],
  ["programTh", "programEn"],
  ["degreeNameTh", "degreeNameEn"],
] as const;

export async function fillThaiNamesFromGraduates(): Promise<number> {
  let updated = 0;
  for (const [th, en] of LOCALIZED_NAME_COLUMNS) {
    const thCol = Prisma.raw(`"${th}"`);
    const enCol = Prisma.raw(`"${en}"`);
    updated += await prisma.$executeRaw`
      UPDATE students s SET ${thCol} = m.th
      FROM (
        SELECT DISTINCT ON (en) en, th FROM (
          SELECT ${enCol} AS en, ${thCol} AS th, count(*) AS n FROM students
          WHERE "detailSyncedAt" IS NOT NULL AND ${enCol} IS NOT NULL AND ${thCol} ~ '[ก-๛]'
          GROUP BY 1, 2
        ) pairs
        ORDER BY en, n DESC, th
      ) m
      WHERE s.${enCol} = m.en AND s.${thCol} = s.${enCol} AND s."detailSyncedAt" IS NULL`;
  }
  return updated;
}

// ไม่ throw — ความล้มเหลวทั้งหมดถูกบันทึกลง SyncJob (ถูกเรียกใน after() จึงไม่มีใครรับ error)
// ถ้าระบบทะเบียนล่มกลางทาง ระเบียนที่ upsert ไปแล้วยังอยู่ และระบบค้นหาจากข้อมูลเดิมได้ตามปกติ
export async function executeBulkSync(
  job: Pick<SyncJob, "id" | "type" | "triggeredById">,
  client: RegistryClient = getRegistryClient(),
): Promise<void> {
  const counts = { recordsFetched: 0, recordsUpserted: 0, recordsInvalid: 0 };
  let updatedSince: Date | undefined;

  try {
    // ต้นทางที่ไม่รองรับ updatedSince (Keystone) ทำงานแบบเต็มชุด — ระเบียนที่ไม่เปลี่ยนถูกข้ามด้วย fingerprint
    if (job.type === "INCREMENTAL" && client.capabilities.incrementalSync) {
      updatedSince = await lastSuccessfulBulkStart(job.id);
    }
    const size = pageSize();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await client.listStudents({ page, pageSize: size, updatedSince });
      const received = result.students.length + result.invalid.length;

      counts.recordsFetched += received;
      counts.recordsInvalid += result.invalid.length;
      counts.recordsUpserted += await upsertChanged(client, result.students, new Date());
      if (result.invalid.length > 0) {
        console.warn("[sync] ข้ามระเบียนรูปแบบผิด", job.id, result.invalid.slice(0, 20));
      }

      await prisma.syncJob.update({ where: { id: job.id }, data: counts });
      // Keystone: หนึ่งหน้า = หนึ่งช่วงรุ่น ซึ่งว่างได้ จึงหยุดตาม hasMore เท่านั้น (MAX_PAGES กันวนไม่รู้จบ)
      if (!result.hasMore) break;
    }

    // เติมชื่อไทยล้มเหลวไม่ทำให้ sync ล้ม — ข้อมูลหลักบันทึกครบแล้ว
    const localizedNames = await fillThaiNamesFromGraduates().catch((error: unknown) => {
      console.error("[sync] เติมชื่อภาษาไทยไม่สำเร็จ", job.id, error);
      return 0;
    });

    await prisma.syncJob.update({
      where: { id: job.id },
      data: { ...counts, status: "SUCCESS", runLock: null, finishedAt: new Date() },
    });
    writeAuditLog({
      action: AuditAction.SYNC_COMPLETED,
      actorId: job.triggeredById,
      entityType: "SyncJob",
      entityId: job.id,
      metadata: {
        type: job.type,
        ...counts,
        localizedNames,
        updatedSince: updatedSince?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const failure = describeError(error);
    console.error("[sync] ซิงก์ไม่สำเร็จ", job.id, error);
    await prisma.syncJob
      .update({
        where: { id: job.id },
        data: { ...counts, ...failure, status: "FAILED", runLock: null, finishedAt: new Date() },
      })
      .catch((e: unknown) => console.error("[sync] บันทึกสถานะงานไม่สำเร็จ", job.id, e));
    writeAuditLog({
      action: AuditAction.SYNC_FAILED,
      actorId: job.triggeredById,
      entityType: "SyncJob",
      entityId: job.id,
      metadata: { type: job.type, ...counts, errorCode: failure.errorCode },
    });
    // F-NOT-05 — ผู้ดูแลระบบเห็นการซิงก์ที่ล้มเหลวในกระดิ่ง (ข้อมูลทะเบียนค้างกระทบทุกคำขอ)
    void notifySyncFailed(job.id, failure.errorCode);
  }
}

export type RefreshStudentResult =
  { ok: true; changed: boolean } | { ok: false; code: SyncErrorCode };

// F-DATA-09: ดึงระเบียนเดียวแบบบังคับเขียนทับ (ไม่ดู sourceUpdatedAt) — ไม่ติด lock ของ bulk sync
export async function refreshStudent(
  studentCode: string,
  { actorId, context }: Actor,
  client: RegistryClient = getRegistryClient(),
): Promise<RefreshStudentResult> {
  const job = await prisma.syncJob.create({
    data: { type: "SINGLE", studentCode, triggeredById: actorId },
  });
  const finish = (data: Prisma.SyncJobUpdateInput) =>
    prisma.syncJob.update({ where: { id: job.id }, data: { ...data, finishedAt: new Date() } });

  try {
    const existing = await prisma.student.findUnique({
      where: { studentCode },
      select: { sourceHash: true, sourceLevel: true, sourceBatch: true },
    });
    const dto = await client.getStudent(studentCode, {
      sourceLevel: existing?.sourceLevel ?? null,
      sourceBatch: existing?.sourceBatch ?? null,
    });
    if (!dto) {
      await finish({
        status: "FAILED",
        errorCode: "NOT_FOUND",
        errorMessage: "ไม่พบระเบียนในระบบทะเบียน",
      });
      return { ok: false, code: "NOT_FOUND" };
    }

    const fingerprint = sourceFingerprint(dto);
    const row = toStudentRow(await withDetail(client, dto), new Date(), fingerprint);
    const student = await prisma.student.upsert({
      where: { studentCode },
      create: row,
      update: row,
      select: { id: true },
    });
    const changed = hasSourceChanged(existing?.sourceHash, fingerprint);

    await fillThaiNamesFromGraduates().catch((error: unknown) =>
      console.error("[sync] เติมชื่อภาษาไทยไม่สำเร็จ", studentCode, error),
    );
    await finish({ status: "SUCCESS", recordsFetched: 1, recordsUpserted: 1 });
    writeAuditLog({
      action: AuditAction.STUDENT_REFRESHED,
      actorId,
      entityType: "Student",
      entityId: student.id,
      metadata: { jobId: job.id, studentCode, changed },
      context,
    });
    return { ok: true, changed };
  } catch (error) {
    const failure = describeError(error);
    console.error("[sync] ดึงข้อมูลรายคนไม่สำเร็จ", studentCode, error);
    await finish({ status: "FAILED", ...failure }).catch((e: unknown) =>
      console.error("[sync] บันทึกสถานะงานไม่สำเร็จ", job.id, e),
    );
    return { ok: false, code: failure.errorCode };
  }
}

export async function getSyncOverview(page: number) {
  const [jobs, totalJobs, running, latestBulk, lastSuccess, studentCount] = await Promise.all([
    prisma.syncJob.findMany({
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * SYNC_HISTORY_PAGE_SIZE,
      take: SYNC_HISTORY_PAGE_SIZE,
      include: { triggeredBy: { select: { name: true } } },
    }),
    prisma.syncJob.count(),
    prisma.syncJob.findUnique({ where: { runLock: BULK_RUN_LOCK } }),
    prisma.syncJob.findFirst({
      where: { type: { in: BULK_TYPES }, status: { not: "RUNNING" } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.syncJob.findFirst({
      where: { type: { in: BULK_TYPES }, status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
    }),
    prisma.student.count(),
  ]);

  return {
    jobs,
    pageCount: Math.max(1, Math.ceil(totalJobs / SYNC_HISTORY_PAGE_SIZE)),
    running,
    latestBulk,
    lastSuccess,
    studentCount,
  };
}

export type SyncHistoryJob = Awaited<ReturnType<typeof getSyncOverview>>["jobs"][number];

export function getRegistryInfo() {
  const client = getRegistryClient();
  return {
    clientName: client.name,
    endpoint: client.endpoint,
    schedule: process.env.SYNC_CRON_SCHEDULE || "0 2 * * *",
  };
}

export async function checkRegistryHealth(): Promise<
  { ok: true; latencyMs: number } | { ok: false; code: SyncErrorCode }
> {
  const started = performance.now();
  try {
    await getRegistryClient({ healthCheck: true }).ping();
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { ok: false, code: describeError(error).errorCode };
  }
}
