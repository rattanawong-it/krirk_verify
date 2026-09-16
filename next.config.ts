import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// F-AUD-09 — security headers ทุกหน้า
// CSP แบบไม่ใช้ nonce (ตามคู่มือ Next.js "Without Nonces") เพื่อให้หน้าสาธารณะยัง prerender ได้
// 'unsafe-inline' จำเป็นสำหรับสคริปต์ hydration ของ Next.js และสคริปต์กันจอกระพริบของ next-themes
const isDev = process.env.NODE_ENV === "development";
const httpsOnly = process.env.APP_URL?.startsWith("https://") ?? false;

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(httpsOnly ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS เฉพาะเมื่อให้บริการผ่าน HTTPS จริง — ถ้าเปิดบน http จะทำให้เบราว์เซอร์จำผิดจนเข้าเครื่อง dev ไม่ได้
  ...(httpsOnly
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // F-OPS-01 — สร้าง .next/standalone (server.js + node_modules ที่จำเป็นเท่านั้น) สำหรับ Docker image
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
