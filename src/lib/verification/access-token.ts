import { timingSafeEqual } from "node:crypto";
import { hashToken } from "@/lib/crypto";

// F-VER-08 — permalink ต้องมีรหัสเข้าถึงที่ตรงกับ hash ในฐานข้อมูล และยังไม่หมดอายุ
// เลขอ้างอิงเรียงลำดับเดาได้ แต่รหัสเข้าถึงสุ่ม 256 บิต จึงเปิดผลของคนอื่นด้วยการเดาไม่ได้

export function matchesAccessToken(storedHash: string | null, provided: string | null): boolean {
  if (!storedHash || !provided || provided.length > 200) return false;
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashToken(provided), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isLinkExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return !expiresAt || expiresAt.getTime() <= now.getTime();
}

export function resultLinkExpiresAt(from: Date = new Date()): Date {
  const days = Number(process.env.RESULT_LINK_EXPIRES_DAYS ?? 90);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 90;
  return new Date(from.getTime() + safeDays * 86_400_000);
}
