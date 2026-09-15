import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export const AuditAction = {
  LOGIN_SUCCESS: "auth.login.success",
  LOGIN_FAILED: "auth.login.failed",
  ACCOUNT_LOCKED: "auth.account.locked",
  LOGOUT: "auth.logout",
  REGISTER_ORGANIZATION: "auth.register.organization",
  REGISTER_ALUMNI: "auth.register.alumni",
  REGISTER_ALUMNI_NOT_MATCHED: "auth.register.alumni.not_matched",
  EMAIL_VERIFIED: "auth.email.verified",
  PASSWORD_RESET_REQUESTED: "auth.password.reset_requested",
  PASSWORD_RESET: "auth.password.reset",
  PASSWORD_CHANGED: "auth.password.changed",
  PROFILE_UPDATED: "user.profile.updated",
  SYNC_STARTED: "sync.started",
  SYNC_COMPLETED: "sync.completed",
  SYNC_FAILED: "sync.failed",
  STUDENT_REFRESHED: "student.refreshed",
  VERIFICATION_SUBMITTED: "verification.submitted",
  VERIFICATION_RATE_LIMITED: "verification.rate_limited",
  VERIFICATION_RESULT_VIEWED: "verification.result.viewed",
  PERMALINK_DENIED: "verification.permalink.denied",
  REVIEW_VIEWED: "verification.review.viewed",
  VERIFICATION_APPROVED: "verification.approved",
  VERIFICATION_REJECTED: "verification.rejected",
  REQUEST_NOTE_ADDED: "verification.note.added",
  PERSONAL_DATA_REVEALED: "personal_data.revealed",
  STUDENT_SEARCHED: "student.searched",
  STUDENT_VIEWED: "student.viewed",
  ORG_APPROVED: "organization.approved",
  ORG_REJECTED: "organization.rejected",
  ORG_SUSPENDED: "organization.suspended",
  ORG_RESTORED: "organization.restored",
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuditEntry = {
  action: AuditActionValue;
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  context?: RequestContext;
};

// non-blocking (F-AUD-01): การบันทึก log ล้มเหลวต้องไม่ทำให้ธุรกรรมหลักล้ม
export function writeAuditLog(entry: AuditEntry): void {
  void prisma.auditLog
    .create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
        ipAddress: entry.context?.ipAddress ?? null,
        userAgent: entry.context?.userAgent?.slice(0, 500) ?? null,
      },
    })
    .catch((error: unknown) => {
      console.error("[audit] บันทึก audit log ไม่สำเร็จ", entry.action, error);
    });
}
