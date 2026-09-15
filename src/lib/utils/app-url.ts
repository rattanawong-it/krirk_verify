import { routing } from "@/i18n/routing";

// URL เต็มสำหรับลิงก์ในอีเมลและปุ่มคัดลอกลิงก์ — ภาษาเริ่มต้นไม่มี prefix ตาม routing ของ next-intl
export function appUrl(path: string, locale: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${base}${prefix}${path}`;
}
