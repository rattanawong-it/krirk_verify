import { routing } from "@/i18n/routing";

export const PENDING_EMAIL_COOKIE = "kv_pending_email";

// กัน open redirect — ยอมรับเฉพาะ path ภายในระบบ
export function safeCallbackUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

// /en/staff/queue?x=1 → /staff/queue?x=1
export function stripLocalePrefix(path: string): string {
  const locales: readonly string[] = routing.locales;
  const first = path.split(/[/?#]/)[1] ?? "";
  if (!locales.includes(first)) return path;
  const rest = path.slice(first.length + 1);
  return rest.startsWith("/") ? rest : `/${rest}`;
}
