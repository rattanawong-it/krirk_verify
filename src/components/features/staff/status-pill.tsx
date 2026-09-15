import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

// ป้ายสถานะแบบจุดสีตาม Design System (ใช้กับสถานภาพนักศึกษา สถานะหน่วยงาน และเหตุที่เข้าคิว)

export type StatusTone = "approved" | "pending" | "rejected" | "notfound" | "expired" | "info";

const TONES: Record<StatusTone, { pill: string; dot: string }> = {
  approved: { pill: "bg-status-approved-bg text-status-approved-tx", dot: "bg-status-approved" },
  pending: { pill: "bg-status-pending-bg text-status-pending-tx", dot: "bg-status-pending" },
  rejected: { pill: "bg-status-rejected-bg text-status-rejected-tx", dot: "bg-status-rejected" },
  notfound: { pill: "bg-status-notfound-bg text-status-notfound-tx", dot: "bg-status-notfound" },
  expired: { pill: "bg-status-expired-bg text-status-expired-tx", dot: "bg-status-expired" },
  info: { pill: "bg-status-info-bg text-status-info-tx", dot: "bg-status-info" },
};

export function StatusPill({
  tone,
  label,
  icon,
  compact = false,
}: {
  tone: StatusTone;
  label: string;
  icon?: IconName;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap",
        compact ? "px-2.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[10.5px]",
        TONES[tone].pill,
      )}
    >
      {icon ? (
        <Icon name={icon} size={12} />
      ) : (
        <span aria-hidden className={cn("size-1.5 rounded-full", TONES[tone].dot)} />
      )}
      {label}
    </span>
  );
}

export const STUDENT_STATUS_TONE = {
  GRADUATED: "approved",
  STUDYING: "info",
  WITHDRAWN: "expired",
  REVOKED: "rejected",
} as const satisfies Record<string, StatusTone>;

export const ORG_STATUS_TONE = {
  PENDING: "pending",
  APPROVED: "approved",
  SUSPENDED: "rejected",
} as const satisfies Record<string, StatusTone>;

export const REVIEW_REASON_STYLE = {
  NO_MATCH: { tone: "notfound", icon: "search" },
  MULTIPLE_MATCHES: { tone: "pending", icon: "users" },
  MANUAL_FLAG: { tone: "rejected", icon: "alert" },
  NOT_GRADUATED: { tone: "rejected", icon: "graduation" },
  INCOMPLETE_RECORD: { tone: "info", icon: "sync" },
  AUTO_APPROVE_DISABLED: { tone: "expired", icon: "settings" },
} as const satisfies Record<string, { tone: StatusTone; icon: IconName }>;
