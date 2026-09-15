import { createHash, timingSafeEqual } from "node:crypto";

// F-DATA-07: ตรวจ header x-cron-secret แบบเวลาคงที่ (เทียบ SHA-256 เพื่อให้ความยาวเท่ากันเสมอ)
// ปฏิเสธทุกคำขอถ้ายังไม่ได้ตั้ง secret จริง เพื่อไม่ให้ endpoint เปิดโล่งบนเครื่องที่ลืมตั้งค่า

export const CRON_SECRET_HEADER = "x-cron-secret";

export function isCronSecretConfigured(expected: string | undefined): expected is string {
  return !!expected && expected.length >= 16 && !expected.startsWith("change-me");
}

export function isValidCronSecret(provided: string | null, expected: string | undefined): boolean {
  if (!isCronSecretConfigured(expected) || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
