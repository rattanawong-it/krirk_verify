import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MultiplicationSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { ComponentProps } from "react";

// ไอคอนภายในของ shadcn/ui — ใช้ชื่อเดียวกับ lucide แต่ render ด้วย Hugeicons ตาม Design System

type IconProps = { className?: string };
type HugeIcon = ComponentProps<typeof HugeiconsIcon>["icon"];

function createIcon(icon: HugeIcon) {
  function ShadcnIcon({ className }: IconProps) {
    return <HugeiconsIcon icon={icon} strokeWidth={2} className={className} aria-hidden />;
  }
  return ShadcnIcon;
}

export const CheckIcon = createIcon(Tick02Icon);
export const ChevronDownIcon = createIcon(ArrowDown01Icon);
export const ChevronUpIcon = createIcon(ArrowUp01Icon);
export const ChevronRightIcon = createIcon(ArrowRight01Icon);
export const XIcon = createIcon(MultiplicationSignIcon);
export const CircleCheckIcon = createIcon(CheckmarkCircle02Icon);
export const InfoIcon = createIcon(InformationCircleIcon);
export const Loader2Icon = createIcon(Loading03Icon);
export const OctagonXIcon = createIcon(CancelCircleIcon);
export const TriangleAlertIcon = createIcon(Alert02Icon);

// จุดทึบของ radio — ไม่กำหนด fill บน <circle> เพื่อให้รับสีจาก class เช่น fill-primary
export function CircleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" />
    </svg>
  );
}
