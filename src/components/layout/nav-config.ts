import type { IconName } from "@/components/ui/icon";
import { type AppRole, REQUESTER_ROLES, ROLES, STAFF_ROLES } from "@/lib/auth/rbac";

export type NavLabelKey =
  | "dashboard"
  | "newRequest"
  | "requests"
  | "batch"
  | "profile"
  | "queue"
  | "students"
  | "organizations"
  | "reports"
  | "auditLogs"
  | "users"
  | "sync"
  | "settings";

export type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  icon: IconName;
  roles: readonly AppRole[];
  // false = หน้ายังไม่พัฒนา แสดงเป็นเมนูปิดไว้แทนลิงก์ที่พาไป 404
  available: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "dashboard",
    icon: "dashboard",
    roles: REQUESTER_ROLES,
    available: true,
  },
  {
    href: "/requests/new",
    labelKey: "newRequest",
    icon: "fileAdd",
    roles: REQUESTER_ROLES,
    available: true,
  },
  {
    href: "/requests",
    labelKey: "requests",
    icon: "fileSearch",
    roles: REQUESTER_ROLES,
    available: true,
  },
  { href: "/batch", labelKey: "batch", icon: "upload", roles: ["EXTERNAL"], available: false },
  {
    href: "/staff/dashboard",
    labelKey: "dashboard",
    icon: "dashboard",
    roles: STAFF_ROLES,
    available: true,
  },
  { href: "/staff/queue", labelKey: "queue", icon: "queue", roles: STAFF_ROLES, available: true },
  {
    href: "/staff/students",
    labelKey: "students",
    icon: "graduation",
    roles: STAFF_ROLES,
    available: true,
  },
  {
    href: "/staff/organizations",
    labelKey: "organizations",
    icon: "building",
    roles: STAFF_ROLES,
    available: true,
  },
  {
    href: "/staff/reports",
    labelKey: "reports",
    icon: "chart",
    roles: STAFF_ROLES,
    available: false,
  },
  { href: "/staff/sync", labelKey: "sync", icon: "sync", roles: STAFF_ROLES, available: true },
  {
    href: "/staff/audit-logs",
    labelKey: "auditLogs",
    icon: "history",
    roles: ["ADMIN"],
    available: false,
  },
  { href: "/staff/users", labelKey: "users", icon: "users", roles: ["ADMIN"], available: false },
  {
    href: "/staff/settings",
    labelKey: "settings",
    icon: "settings",
    roles: ["ADMIN"],
    available: false,
  },
  { href: "/profile", labelKey: "profile", icon: "userCircle", roles: ROLES, available: true },
];

export function navItemsFor(role: AppRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function isNavItemActive(item: { href: string }, pathname: string): boolean {
  if (pathname === item.href) return true;
  // /requests ต้องไม่ active เมื่ออยู่ที่ /requests/new ซึ่งมีเมนูของตัวเอง
  const deeperItem = NAV_ITEMS.some(
    (other) =>
      other.href !== item.href &&
      other.href.startsWith(`${item.href}/`) &&
      pathname.startsWith(other.href),
  );
  return !deeperItem && pathname.startsWith(`${item.href}/`);
}
