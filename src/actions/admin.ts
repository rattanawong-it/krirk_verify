"use server";

import { refresh, revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { runRetention } from "@/lib/services/retention.service";
import { updateSettings } from "@/lib/services/settings.service";
import { createStaffUser, runUserAction, updateUser } from "@/lib/services/user-admin.service";
import { type ActionState, fieldErrorsOf } from "@/lib/utils/action-state";
import { getRequestContext } from "@/lib/utils/request-context";
import { createStaffUserSchema, updateUserSchema, userActionSchema } from "@/lib/validations/admin";
import { settingsFormSchema } from "@/lib/validations/settings";

// Phase 7 — Server Action ของผู้ดูแลระบบ (ADMIN เท่านั้น): auth + validate + เรียก service

const ADMIN = ["ADMIN"] as const;

export async function saveSettingsAction(input: unknown): Promise<ActionState> {
  const admin = await requireRole(ADMIN);
  const parsed = settingsFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const { changed } = await updateSettings(parsed.data, admin.id, await getRequestContext());
  // หน้าแรกและหน้านโยบาย prerender เป็น static — สร้างใหม่ให้เห็นประกาศ/ระยะเก็บรักษาล่าสุด
  if (changed > 0) {
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}`);
      revalidatePath(`/${locale}/privacy`);
    }
  }
  refresh();
  return changed > 0
    ? { ok: true, message: "settings.saved", messageValues: { count: changed } }
    : { ok: true, message: "settings.noChanges" };
}

export async function runRetentionAction(): Promise<ActionState> {
  const admin = await requireRole(ADMIN);
  const run = await runRetention({ actorId: admin.id, context: await getRequestContext() });
  refresh();
  return {
    ok: true,
    message: "settings.retention.ran",
    messageValues: { anonymized: run.anonymized, auditDeleted: run.auditDeleted },
  };
}

export async function createStaffUserAction(input: unknown): Promise<ActionState> {
  const admin = await requireRole(ADMIN);
  const parsed = createStaffUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await createStaffUser(parsed.data, admin, await getRequestContext());
  refresh();
  if (!result.ok) {
    const key = `users.errors.${result.code}`;
    return {
      ok: false,
      error: key,
      fieldErrors: result.code === "emailTaken" ? { email: key } : undefined,
    };
  }
  return { ok: true, message: "users.done.created" };
}

export async function updateUserAction(input: unknown): Promise<ActionState> {
  const admin = await requireRole(ADMIN);
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await updateUser(parsed.data, admin, await getRequestContext());
  refresh();
  if (!result.ok) return { ok: false, error: `users.errors.${result.code}` };
  return { ok: true, message: "users.done.updated" };
}

export async function userAction(input: unknown): Promise<ActionState> {
  const admin = await requireRole(ADMIN);
  const parsed = userActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "users.errors.notFound" };

  const result = await runUserAction(
    parsed.data.userId,
    parsed.data.action,
    admin,
    await getRequestContext(),
  );
  refresh();
  if (!result.ok) return { ok: false, error: `users.errors.${result.code}` };
  return { ok: true, message: `users.done.${parsed.data.action}` };
}
