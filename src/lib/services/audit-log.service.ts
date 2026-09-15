import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuditQuery } from "@/lib/validations/admin";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";

// F-AUD-03 / F-AUD-04 — ค้นหาและส่งออก Audit Log (ADMIN เท่านั้น)

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_MAX_ROWS = 100_000;
const EXPORT_BATCH = 1000;

export const KNOWN_AUDIT_ACTIONS = Object.values(AuditAction).sort();

const RANGE_MS = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 } as const;

function bangkokDay(isoDay: string, offsetDays = 0): Date {
  return new Date(new Date(`${isoDay}T00:00:00+07:00`).getTime() + offsetDays * 86_400_000);
}

export function auditWhere(query: AuditQuery, now: Date = new Date()): Prisma.AuditLogWhereInput {
  const conditions: Prisma.AuditLogWhereInput[] = [];
  if (query.action) conditions.push({ action: query.action });

  // ช่วงวันที่ที่ระบุเองมีผลเหนือช่วงสำเร็จรูป
  if (query.from || query.to) {
    conditions.push({
      createdAt: {
        ...(query.from ? { gte: bangkokDay(query.from) } : {}),
        ...(query.to ? { lt: bangkokDay(query.to, 1) } : {}),
      },
    });
  } else if (query.range !== "all") {
    conditions.push({ createdAt: { gte: new Date(now.getTime() - RANGE_MS[query.range]) } });
  }

  const q = query.q?.trim();
  if (q) {
    conditions.push({
      OR: [
        { actor: { is: { email: { contains: q, mode: "insensitive" } } } },
        { actor: { is: { name: { contains: q, mode: "insensitive" } } } },
        { action: { contains: q.toLowerCase() } },
        { entityId: q },
        { ipAddress: { startsWith: q } },
        { metadata: { path: ["refNo"], equals: q.toUpperCase() } },
        { metadata: { path: ["studentCode"], equals: q } },
      ],
    });
  }
  return { AND: conditions };
}

const auditSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  ipAddress: true,
  userAgent: true,
  metadata: true,
  createdAt: true,
  actor: { select: { name: true, email: true, role: true } },
} satisfies Prisma.AuditLogSelect;

export async function listAuditLogs(query: AuditQuery, now: Date = new Date()) {
  const where = auditWhere(query, now);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: auditSelect,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}

export type AuditRow = Awaited<ReturnType<typeof listAuditLogs>>["rows"][number];

// ส่งออกทีละชุด (cursor) เพื่อไม่โหลดทั้งตารางเข้าหน่วยความจำ
export async function* iterateAuditLogs(query: AuditQuery, now: Date = new Date()) {
  const where = auditWhere(query, now);
  let cursor: string | undefined;
  let exported = 0;
  while (exported < AUDIT_EXPORT_MAX_ROWS) {
    const batch = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(EXPORT_BATCH, AUDIT_EXPORT_MAX_ROWS - exported),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: auditSelect,
    });
    if (batch.length === 0) return;
    exported += batch.length;
    cursor = batch[batch.length - 1]!.id;
    yield batch;
  }
}

export function recordAuditExport(
  actorId: string,
  query: AuditQuery,
  context: RequestContext,
): void {
  writeAuditLog({
    action: AuditAction.AUDIT_EXPORTED,
    actorId,
    entityType: "AuditLog",
    metadata: {
      q: query.q ?? null,
      action: query.action ?? null,
      range: query.range,
      from: query.from ?? null,
      to: query.to ?? null,
    },
    context,
  });
}
