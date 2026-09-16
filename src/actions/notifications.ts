"use server";

import { refresh } from "next/cache";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { resendEmail } from "@/lib/services/email-log.service";
import { markAllRead, markRead } from "@/lib/services/notification.service";
import type { ActionState } from "@/lib/utils/action-state";
import { getRequestContext } from "@/lib/utils/request-context";
import { resendEmailSchema } from "@/lib/validations/admin";

// Phase 9 — Server Action ของการแจ้งเตือน: auth + validate + เรียก service
// ผู้ใช้อ่าน/ปิดได้เฉพาะการแจ้งเตือนของตนเอง (service กรองด้วย userId เสมอ)

export async function markAllNotificationsReadAction(): Promise<ActionState> {
  const user = await requireAuth();
  const count = await markAllRead(user.id);
  refresh();
  return { ok: true, message: "notifications.allRead", messageValues: { count } };
}

export async function markNotificationReadAction(id: string): Promise<ActionState> {
  const user = await requireAuth();
  await markRead(user.id, id.slice(0, 40));
  refresh();
  return { ok: true };
}

// F-NOT-04 — ผู้ดูแลกดส่งซ้ำอีเมลที่ล้มเหลว (เช่น หลังแก้ปัญหา SMTP)
export async function resendEmailAction(input: unknown): Promise<ActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = resendEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "emailLogs.errors.notFound" };

  const result = await resendEmail(parsed.data.id, admin.id, await getRequestContext());
  refresh();
  if (!result.ok) return { ok: false, error: "emailLogs.errors.notFound" };
  return result.sent
    ? { ok: true, message: "emailLogs.done.resent" }
    : { ok: false, error: "emailLogs.errors.stillFailing" };
}
