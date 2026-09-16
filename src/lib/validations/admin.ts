import { z } from "zod";
import { emailField, optionalText, requiredText } from "./auth";

// Phase 7 — schema ของหน้าผู้ดูแลระบบ (Audit Log, ผู้ใช้)

const isoDay = z.iso.date().optional().catch(undefined);
const page = z.coerce.number().int().min(1).max(10_000).catch(1);

export const AUDIT_RANGES = ["24h", "7d", "30d", "all"] as const;

export const auditQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  action: z
    .string()
    .regex(/^[a-z_.]{3,60}$/)
    .optional()
    .catch(undefined),
  range: z.enum(AUDIT_RANGES).catch("7d"),
  from: isoDay,
  to: isoDay,
  page,
});

export type AuditQuery = z.output<typeof auditQuerySchema>;

// F-NOT-04 — ตัวกรองหน้าประวัติการส่งอีเมล (ADMIN)
export const EMAIL_STATUSES = ["PENDING", "SENT", "FAILED"] as const;

export const emailLogQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(EMAIL_STATUSES).optional().catch(undefined),
  template: z
    .string()
    .regex(/^[A-Za-z]{3,40}$/)
    .optional()
    .catch(undefined),
  range: z.enum(AUDIT_RANGES).catch("7d"),
  page,
});

export type EmailLogQuery = z.output<typeof emailLogQuerySchema>;

export const resendEmailSchema = z.object({ id: z.string().trim().min(1).max(40) });

export const USER_ROLES = ["ADMIN", "REGISTRAR", "EXTERNAL", "ALUMNI"] as const;
export const STAFF_USER_ROLES = ["ADMIN", "REGISTRAR"] as const;
export const USER_STATUSES = ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED"] as const;

export const userQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  role: z.enum(USER_ROLES).optional().catch(undefined),
  status: z.enum(USER_STATUSES).optional().catch(undefined),
  page,
});

export type UserQuery = z.output<typeof userQuerySchema>;

const phoneField = z
  .string()
  .trim()
  .regex(/^([0-9+\-\s()]{9,20})?$/, "validation.phone")
  .optional()
  .transform((v) => (v ? v : undefined));

// ผู้ดูแลสร้างได้เฉพาะบัญชีเจ้าหน้าที่ — หน่วยงานภายนอกและศิษย์เก่าต้องลงทะเบียนเองเพื่อยืนยันตัวตน
export const createStaffUserSchema = z.object({
  name: requiredText(),
  email: emailField,
  role: z.enum(STAFF_USER_ROLES, "validation.required"),
  position: optionalText(),
  phone: phoneField,
});

export const updateUserSchema = z.object({
  userId: z.string().trim().min(1).max(40),
  name: requiredText(),
  position: optionalText(),
  phone: phoneField,
  role: z.enum(USER_ROLES),
});

export const USER_ACTIONS = ["suspend", "activate", "unlock", "sendReset"] as const;

export const userActionSchema = z.object({
  userId: z.string().trim().min(1).max(40),
  action: z.enum(USER_ACTIONS),
});

export type CreateStaffUserInput = z.input<typeof createStaffUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type UserAction = (typeof USER_ACTIONS)[number];
