import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type Variant = "error" | "warning" | "info" | "success" | "gold";

const VARIANTS: Record<Variant, { className: string; icon: IconName; iconClass: string }> = {
  error: {
    className: "border-status-rejected/25 bg-status-rejected-bg text-status-rejected-tx",
    icon: "alert",
    iconClass: "text-status-rejected",
  },
  warning: {
    className: "border-status-pending/25 bg-status-pending-bg text-status-pending-tx",
    icon: "alert",
    iconClass: "text-status-pending",
  },
  info: {
    className: "border-border bg-surface text-text-2",
    icon: "info",
    iconClass: "text-muted-foreground",
  },
  success: {
    className: "border-status-approved/25 bg-status-approved-bg text-status-approved-tx",
    icon: "checkCircle",
    iconClass: "text-status-approved",
  },
  gold: {
    className: "border-gold/35 bg-gold-soft text-[#6b4e0a] dark:text-gold",
    icon: "lock",
    iconClass: "text-gold",
  },
};

export function FormAlert({
  variant,
  icon,
  children,
  className,
}: {
  variant: Variant;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  const style = VARIANTS[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-[10px] border p-3 text-xs leading-relaxed",
        style.className,
        className,
      )}
    >
      <Icon name={icon ?? style.icon} size={16} className={cn("mt-px shrink-0", style.iconClass)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
