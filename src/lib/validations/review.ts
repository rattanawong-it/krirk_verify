import { z } from "zod";
import { REJECT_REASONS } from "@/lib/verification/reject-reasons";
import { optionalText, requiredText } from "./auth";

// Phase 4 — schema ของงานเจ้าหน้าที่ทะเบียน (ใช้ร่วม client/server)

const refNoField = z.string().trim().min(1, "validation.required").max(30);

export const approveRequestSchema = z.object({
  refNo: refNoField,
  studentId: z.string().trim().min(1, "review.errors.selectStudent").max(40),
});

export const rejectRequestSchema = z
  .object({
    refNo: refNoField,
    reason: z.enum(REJECT_REASONS, "validation.required"),
    detail: optionalText(1000),
  })
  .superRefine((data, ctx) => {
    if (data.reason === "OTHER" && !data.detail) {
      ctx.addIssue({ code: "custom", path: ["detail"], message: "validation.required" });
    }
  });

export const internalNoteSchema = z.object({
  refNo: refNoField,
  body: requiredText(2000),
});

export const ORG_ACTIONS = ["approve", "reject", "suspend", "restore"] as const;

export const organizationActionSchema = z
  .object({
    organizationId: z.string().trim().min(1).max(40),
    action: z.enum(ORG_ACTIONS),
    reason: optionalText(500),
  })
  .superRefine((data, ctx) => {
    if ((data.action === "reject" || data.action === "suspend") && !data.reason) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "validation.required" });
    }
  });

const isoDay = z.iso.date().optional().catch(undefined);

export const queueQuerySchema = z.object({
  reason: z
    .enum([
      "NO_MATCH",
      "MULTIPLE_MATCHES",
      "MANUAL_FLAG",
      "NOT_GRADUATED",
      "INCOMPLETE_RECORD",
      "AUTO_APPROVE_DISABLED",
    ])
    .optional()
    .catch(undefined),
  sla: z.literal("over").optional().catch(undefined),
  org: z.string().trim().max(40).optional().catch(undefined),
  from: isoDay,
  to: isoDay,
  sort: z.enum(["oldest", "newest"]).catch("oldest"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const studentQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  faculty: z.string().trim().max(200).optional().catch(undefined),
  status: z.enum(["GRADUATED", "STUDYING", "WITHDRAWN", "REVOKED"]).optional().catch(undefined),
  flagged: z.literal("1").optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export const organizationQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED"]).catch("PENDING"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ApproveRequestInput = z.input<typeof approveRequestSchema>;
export type RejectRequestInput = z.input<typeof rejectRequestSchema>;
export type RejectRequestData = z.output<typeof rejectRequestSchema>;
export type InternalNoteInput = z.input<typeof internalNoteSchema>;
export type OrganizationActionInput = z.input<typeof organizationActionSchema>;
export type QueueQuery = z.output<typeof queueQuerySchema>;
export type StudentQuery = z.output<typeof studentQuerySchema>;
