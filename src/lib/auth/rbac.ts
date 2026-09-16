// กฎสิทธิ์ตาม path — เป็น pure function เพื่อใช้ได้ทั้งใน proxy, server component และ unit test

export const ROLES = ["ADMIN", "REGISTRAR", "EXTERNAL", "ALUMNI"] as const;
export type AppRole = (typeof ROLES)[number];

export const STAFF_ROLES: readonly AppRole[] = ["ADMIN", "REGISTRAR"];
export const REQUESTER_ROLES: readonly AppRole[] = ["EXTERNAL", "ALUMNI"];

export type RouteAccess =
  { kind: "public" } | { kind: "guest" } | { kind: "auth"; roles: readonly AppRole[] | null };

export type AccessDecision = "allow" | "login" | "forbidden" | "home";

const ADMIN_ONLY_PREFIXES = [
  "/staff/audit-logs",
  "/staff/email-logs",
  "/staff/users",
  "/staff/settings",
];
const STAFF_PREFIXES = ["/staff"];
const EXTERNAL_ONLY_PREFIXES = ["/batch"];
const REQUESTER_PREFIXES = ["/dashboard", "/requests"];
const ANY_AUTH_PREFIXES = ["/profile"];
const GUEST_PREFIXES = ["/login", "/register", "/forgot-password"];

function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isStaffRole(role: AppRole): boolean {
  return STAFF_ROLES.includes(role);
}

export function homePathFor(role: AppRole): string {
  return isStaffRole(role) ? "/staff/dashboard" : "/dashboard";
}

// pathname ต้องตัด locale prefix ออกแล้ว เช่น /en/staff/users → /staff/users
export function getRouteAccess(pathname: string): RouteAccess {
  if (matches(pathname, ADMIN_ONLY_PREFIXES)) return { kind: "auth", roles: ["ADMIN"] };
  if (matches(pathname, STAFF_PREFIXES)) return { kind: "auth", roles: STAFF_ROLES };
  if (matches(pathname, EXTERNAL_ONLY_PREFIXES)) return { kind: "auth", roles: ["EXTERNAL"] };
  if (matches(pathname, REQUESTER_PREFIXES)) return { kind: "auth", roles: REQUESTER_ROLES };
  if (matches(pathname, ANY_AUTH_PREFIXES)) return { kind: "auth", roles: null };
  if (matches(pathname, GUEST_PREFIXES)) return { kind: "guest" };
  return { kind: "public" };
}

export function decideAccess(
  access: RouteAccess,
  role: AppRole | null | undefined,
): AccessDecision {
  if (access.kind === "public") return "allow";
  if (access.kind === "guest") return role ? "home" : "allow";
  if (!role) return "login";
  if (access.roles && !access.roles.includes(role)) return "forbidden";
  return "allow";
}

export function hasRole(role: AppRole | null | undefined, allowed: readonly AppRole[]): boolean {
  return !!role && allowed.includes(role);
}
