import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MAX_EMAIL_ATTEMPTS, retryEmails } from "@/lib/email/mailer";
import type { EmailLogQuery } from "@/lib/validations/admin";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";

// F-NOT-04 — หน้าประวัติการส่งอีเมลของผู้ดูแลระบบ (เลื่อนมาจาก Phase 7)

export const EMAIL_LOG_PAGE_SIZE = 25;

const RANGE_MS = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 } as const;

export function emailLogWhere(
  query: EmailLogQuery,
  now: Date = new Date(),
): Prisma.EmailLogWhereInput {
  const conditions: Prisma.EmailLogWhereInput[] = [];
  if (query.status) conditions.push({ status: query.status });
  if (query.template) conditions.push({ template: query.template });
  if (query.range !== "all") {
    conditions.push({ createdAt: { gte: new Date(now.getTime() - RANGE_MS[query.range]) } });
  }

  const q = query.q?.trim();
  if (q) {
    conditions.push({
      OR: [
        { to: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { entityId: q },
      ],
    });
  }
  return { AND: conditions };
}

const emailLogSelect = {
  id: true,
  to: true,
  template: true,
  subject: true,
  locale: true,
  status: true,
  attempts: true,
  lastError: true,
  nextRetryAt: true,
  sentAt: true,
  entityType: true,
  entityId: true,
  createdAt: true,
  user: { select: { name: true, role: true } },
} satisfies Prisma.EmailLogSelect;

export type EmailLogRow = Prisma.EmailLogGetPayload<{ select: typeof emailLogSelect }>;

export async function listEmailLogs(query: EmailLogQuery, now: Date = new Date()) {
  const where = emailLogWhere(query, now);
  const [rows, total, failed] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * EMAIL_LOG_PAGE_SIZE,
      take: EMAIL_LOG_PAGE_SIZE,
      select: emailLogSelect,
    }),
    prisma.emailLog.count({ where }),
    // จำนวนที่ยังส่งไม่สำเร็จทั้งระบบ (ไม่ขึ้นกับตัวกรอง) — ใช้เตือนผู้ดูแลบนหัวหน้า
    prisma.emailLog.count({ where: { status: "FAILED" } }),
  ]);
  return { rows, total, failed, pageCount: Math.max(1, Math.ceil(total / EMAIL_LOG_PAGE_SIZE)) };
}

// รายชื่อเทมเพลตที่เคยส่งจริง — ใช้เป็นตัวเลือกในตัวกรอง (ไม่ต้องรู้จักทะเบียนเทมเพลตทั้งหมด)
export async function usedTemplates(): Promise<string[]> {
  const rows = await prisma.emailLog.findMany({
    distinct: ["template"],
    orderBy: { template: "asc" },
    select: { template: true },
  });
  return rows.map((row) => row.template);
}

export type ResendResult = { ok: true; sent: boolean } | { ok: false; code: "notFound" };

export async function resendEmail(
  id: string,
  actorId: string,
  context: RequestContext,
): Promise<ResendResult> {
  const log = await prisma.emailLog.findUnique({
    where: { id },
    select: { id: true, to: true, template: true, status: true },
  });
  // ส่งซ้ำได้เฉพาะฉบับที่ล้มเหลว — ฉบับที่ส่งสำเร็จแล้วต้องไม่ถูกส่งซ้ำโดยไม่ตั้งใจ
  if (!log || log.status !== "FAILED") return { ok: false, code: "notFound" };

  const outcome = await retryEmails({ id, limit: 1 });
  writeAuditLog({
    action: AuditAction.EMAIL_RESENT,
    actorId,
    entityType: "EmailLog",
    entityId: id,
    metadata: { template: log.template, sent: outcome.sent },
    context,
  });
  return { ok: true, sent: outcome.sent > 0 };
}

export { MAX_EMAIL_ATTEMPTS };
