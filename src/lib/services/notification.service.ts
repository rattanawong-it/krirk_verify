import "server-only";
import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendTemplateMail } from "@/lib/email/mailer";
import { bangkokDayKey, dayStart } from "@/lib/reports/range";
import { appUrl } from "@/lib/utils/app-url";
import { slaCutoff } from "@/lib/verification/sla";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";
import { QUEUE_DIGEST_LAST_SENT_KEY, getSettings } from "./settings.service";

// F-NOT-05 — การแจ้งเตือนในระบบ (กระดิ่งบน header ตาม project-ui/3)
// เก็บเป็น type + params แล้วแปลตอนแสดงผล ผู้ใช้จึงเห็นข้อความตามภาษาที่เลือกอยู่เสมอ

export const BELL_LIMIT = 8;
export const NOTIFICATION_PAGE_SIZE = 20;

export type NewNotification = {
  userId: string;
  type: NotificationType;
  params?: Prisma.InputJsonValue;
  href?: string;
  // กันสร้างซ้ำ (unique ต่อผู้ใช้) เช่นสรุป SLA ของวันเดียวกัน
  dedupeKey?: string;
};

export async function createNotifications(items: NewNotification[]): Promise<number> {
  if (items.length === 0) return 0;
  const { count } = await prisma.notification.createMany({
    data: items.map((item) => ({
      userId: item.userId,
      type: item.type,
      params: item.params,
      href: item.href,
      dedupeKey: item.dedupeKey,
    })),
    skipDuplicates: true,
  });
  return count;
}

// non-blocking เหมือน audit log (F-AUD-01) — แจ้งเตือนล้มเหลวต้องไม่ทำให้ธุรกรรมหลักล้ม
export function notify(items: NewNotification[]): void {
  void createNotifications(items).catch((error: unknown) => {
    console.error("[notification] สร้างการแจ้งเตือนไม่สำเร็จ", error);
  });
}

// แจ้งเจ้าหน้าที่ทุกคนที่ใช้งานอยู่ (ADMIN + REGISTRAR ตามที่ระบุ)
export async function notifyStaff(
  input: Omit<NewNotification, "userId"> & { roles?: ("ADMIN" | "REGISTRAR")[] },
): Promise<number> {
  const staff = await prisma.user.findMany({
    where: { role: { in: input.roles ?? ["ADMIN", "REGISTRAR"] }, status: "ACTIVE" },
    select: { id: true },
  });
  return createNotifications(staff.map(({ id }) => ({ ...input, userId: id })));
}

const bellSelect = {
  id: true,
  type: true,
  params: true,
  href: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof bellSelect }>;

export async function getBellState(userId: string) {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: BELL_LIMIT,
      select: bellSelect,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { rows, unread };
}

export async function listNotifications(userId: string, page: number) {
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * NOTIFICATION_PAGE_SIZE,
      take: NOTIFICATION_PAGE_SIZE,
      select: bellSelect,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE)) };
}

// where กำหนด userId เสมอ — ผู้ใช้อ่าน/ปิดได้เฉพาะการแจ้งเตือนของตนเอง
export async function markAllRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}

// ------------------------------------------------------------
// ตัวช่วยตามเหตุการณ์ — เรียกแบบ non-blocking จาก service ที่เกี่ยวข้อง
// ------------------------------------------------------------

// F-NOT-03 — คำขอเข้าคิว: แจ้งในระบบทันที (อีเมลเป็นสรุปรายวันเพื่อไม่ให้อีเมลท่วม)
export async function notifyQueueEntry(refNo: string): Promise<number> {
  return notifyStaff({
    type: "QUEUE_NEW",
    params: { refNo },
    href: `/staff/queue/${refNo}`,
    dedupeKey: `queue:${refNo}`,
  });
}

export async function notifyOrganizationPending(orgId: string, orgName: string): Promise<number> {
  return notifyStaff({
    type: "ORG_PENDING",
    params: { orgName },
    href: `/staff/organizations/${orgId}`,
    dedupeKey: `org:${orgId}`,
  });
}

// ซิงก์ล้มเหลวเป็นเรื่องของผู้ดูแลระบบ ไม่ใช่เจ้าหน้าที่ทะเบียน
export async function notifySyncFailed(
  jobId: string,
  errorCode: string | null | undefined,
): Promise<number> {
  return notifyStaff({
    type: "SYNC_FAILED",
    params: { errorCode: (errorCode ?? "INTERNAL").slice(0, 60) },
    href: "/staff/sync",
    dedupeKey: `sync:${jobId}`,
    roles: ["ADMIN"],
  });
}

// แจ้งผู้ขอเมื่อเจ้าหน้าที่ตัดสินคำขอแล้ว (คู่กับอีเมลฉบับเดิม)
export function notifyRequestDecided(input: {
  userId: string;
  refNo: string;
  approved: boolean;
}): void {
  notify([
    {
      userId: input.userId,
      type: input.approved ? "REQUEST_APPROVED" : "REQUEST_REJECTED",
      params: { refNo: input.refNo },
      href: `/requests/${input.refNo}`,
      dedupeKey: `decided:${input.refNo}`,
    },
  ]);
}

export async function markRead(userId: string, id: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

// ------------------------------------------------------------
// F-NOT-03 — สรุปคิวคำขอรายวันทางอีเมล (ฉบับเดียวต่อวัน ไม่ส่งรายคำขอ)
// ------------------------------------------------------------

async function recordDigestDay(day: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: QUEUE_DIGEST_LAST_SENT_KEY },
    create: { key: QUEUE_DIGEST_LAST_SENT_KEY, value: day },
    update: { value: day },
  });
}

export async function sendQueueDigest(context: RequestContext, now: Date = new Date()) {
  const settings = await getSettings();
  if (!settings.queueDigestEnabled) return { status: "disabled" as const };

  // กันส่งซ้ำเมื่อ cron ถูกเรียกหลายครั้งในวันเดียวกัน (เทียบตามวันเวลาไทย)
  const day = bangkokDayKey(now);
  const lastSent = await prisma.appSetting.findUnique({
    where: { key: QUEUE_DIGEST_LAST_SENT_KEY },
  });
  if (lastSent?.value === day) return { status: "alreadySent" as const, day };

  const pendingWhere = { status: "PENDING_REVIEW" } as const;
  const [pending, newToday, overSla, oldest] = await Promise.all([
    prisma.verificationRequest.count({ where: pendingWhere }),
    prisma.verificationRequest.count({ where: { createdAt: { gte: dayStart(day) } } }),
    prisma.verificationRequest.count({
      where: { ...pendingWhere, createdAt: { lt: slaCutoff(now, settings.slaHours) } },
    }),
    prisma.verificationRequest.findFirst({
      where: pendingWhere,
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  // คิวว่าง = ไม่ต้องรบกวนกล่องอีเมลของเจ้าหน้าที่ แต่ยังนับว่าตรวจแล้วของวันนี้
  if (pending === 0) {
    await recordDigestDay(day);
    return { status: "empty" as const, day };
  }

  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "REGISTRAR"] }, status: "ACTIVE" },
    select: { id: true, email: true, name: true, locale: true },
  });
  const oldestWaitHours = oldest
    ? Math.round(((now.getTime() - oldest.createdAt.getTime()) / 3_600_000) * 10) / 10
    : null;

  let sent = 0;
  for (const person of staff) {
    const locale = person.locale === "en" ? "en" : "th";
    const ok = await sendTemplateMail({
      template: "queueDigest",
      to: person.email,
      userId: person.id,
      entityType: "QueueDigest",
      entityId: day,
      payload: {
        locale,
        name: person.name,
        generatedAt: now,
        newToday,
        pending,
        overSla,
        oldestWaitHours,
        url: appUrl("/staff/queue", locale),
      },
    });
    if (ok) sent++;
  }

  // F-REG-09 / F-NOT-05 — คำขอที่เกิน SLA เป็นเรื่องเร่งด่วน แจ้งในกระดิ่งวันละครั้งด้วย
  if (overSla > 0) {
    await notifyStaff({
      type: "SLA_BREACH",
      params: { count: overSla },
      href: "/staff/queue",
      dedupeKey: `sla:${day}`,
    });
  }

  await recordDigestDay(day);
  writeAuditLog({
    action: AuditAction.QUEUE_DIGEST_SENT,
    actorId: null,
    entityType: "QueueDigest",
    entityId: day,
    metadata: { day, pending, overSla, newToday, recipients: staff.length, sent },
    context,
  });
  return { status: "sent" as const, day, recipients: staff.length, sent, pending, overSla };
}
