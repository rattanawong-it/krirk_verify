"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import { changeOrganizationStatus } from "@/lib/services/organization.service";
import * as reviewService from "@/lib/services/review.service";
import { revealStudentIdentifier } from "@/lib/services/student.service";
import { type ActionState, fieldErrorsOf } from "@/lib/utils/action-state";
import { getRequestContext } from "@/lib/utils/request-context";
import {
  approveRequestSchema,
  internalNoteSchema,
  organizationActionSchema,
  rejectRequestSchema,
} from "@/lib/validations/review";

// Phase 4 — Server Action ของเจ้าหน้าที่: auth + validate + เรียก service (spec ข้อ 5.2)

export type RevealState = { ok: true; value: string } | { ok: false };

export async function approveRequestAction(input: unknown): Promise<ActionState> {
  const staff = await requireRole(STAFF_ROLES);
  const parsed = approveRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "validation.required" };
  }
  const result = await reviewService.approveRequest(parsed.data, staff, await getRequestContext());
  refresh();
  if (!result.ok) return { ok: false, error: `review.errors.${result.code}` };
  return { ok: true, message: "review.approved" };
}

export async function rejectRequestAction(input: unknown): Promise<ActionState> {
  const staff = await requireRole(STAFF_ROLES);
  const parsed = rejectRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const result = await reviewService.rejectRequest(parsed.data, staff, await getRequestContext());
  refresh();
  if (!result.ok) return { ok: false, error: `review.errors.${result.code}` };
  return { ok: true, message: "review.rejected" };
}

export async function addInternalNoteAction(input: unknown): Promise<ActionState> {
  const staff = await requireRole(STAFF_ROLES);
  const parsed = internalNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const result = await reviewService.addInternalNote(parsed.data, staff, await getRequestContext());
  refresh();
  if (!result.ok) return { ok: false, error: `review.errors.${result.code}` };
  return { ok: true, message: "review.noteAdded" };
}

export async function revealRequestKeyAction(refNo: unknown): Promise<RevealState> {
  const staff = await requireRole(STAFF_ROLES);
  if (typeof refNo !== "string") return { ok: false };
  const value = await reviewService.revealSearchValue(refNo, staff, await getRequestContext());
  return value ? { ok: true, value } : { ok: false };
}

export async function revealStudentIdAction(
  studentCode: unknown,
  field: unknown,
): Promise<RevealState> {
  const staff = await requireRole(STAFF_ROLES);
  if (typeof studentCode !== "string" || (field !== "citizenId" && field !== "passportNo")) {
    return { ok: false };
  }
  const value = await revealStudentIdentifier(studentCode, field, staff, await getRequestContext());
  return value ? { ok: true, value } : { ok: false };
}

export async function changeOrganizationStatusAction(input: unknown): Promise<ActionState> {
  const staff = await requireRole(STAFF_ROLES);
  const parsed = organizationActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const result = await changeOrganizationStatus(parsed.data, staff, await getRequestContext());
  refresh();
  if (!result.ok) return { ok: false, error: `orgs.errors.${result.code}` };
  return { ok: true, message: `orgs.done.${parsed.data.action}` };
}
