import type { RequestStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<RequestStatus, { pill: string; dot: string }> = {
  PENDING_REVIEW: { pill: "bg-status-pending-bg text-status-pending-tx", dot: "bg-status-pending" },
  APPROVED: { pill: "bg-status-approved-bg text-status-approved-tx", dot: "bg-status-approved" },
  REJECTED: { pill: "bg-status-rejected-bg text-status-rejected-tx", dot: "bg-status-rejected" },
  NOT_FOUND: { pill: "bg-status-notfound-bg text-status-notfound-tx", dot: "bg-status-notfound" },
  EXPIRED: { pill: "bg-status-expired-bg text-status-expired-tx", dot: "bg-status-expired" },
  DRAFT: { pill: "bg-status-expired-bg text-status-expired-tx", dot: "bg-status-expired" },
};

export function RequestStatusBadge({
  status,
  label,
  compact = false,
}: {
  status: RequestStatus;
  label: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap",
        compact ? "px-2.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        STATUS_STYLE[status].pill,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_STYLE[status].dot)} />
      {label}
    </span>
  );
}
