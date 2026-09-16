// F-AUD-08 — จุดตัดของนโยบายเก็บรักษาข้อมูล (pure function เพื่อ unit test ได้)

const DAY_MS = 86_400_000;

// คำขอที่ "พิจารณาแล้ว (หรือยื่น ถ้ายังไม่พิจารณา)" ก่อนเวลานี้ ถึงกำหนด anonymise
export function requestRetentionCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

// audit log ที่เก่ากว่าเวลานี้ลบได้ — นับเป็นปีปฏิทิน (รองรับปีอธิกสุรทิน)
export function auditRetentionCutoff(now: Date, years: number): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return cutoff;
}

// ประวัติอีเมลที่สร้างก่อนเวลานี้ลบได้ (ไม่แยกสถานะ — อีเมลที่ล้มเหลวเกินกำหนดแล้วไม่มีประโยชน์ที่จะส่งซ้ำ)
export function emailLogRetentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export const ANONYMIZED_MARKER = "ANONYMIZED";
