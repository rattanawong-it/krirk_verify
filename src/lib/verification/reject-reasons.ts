// F-REG-05 — เหตุผลการปฏิเสธที่เจ้าหน้าที่เลือกได้ (แสดงสองภาษาจากรหัส)
// "ไม่พบข้อมูลที่ตรงกัน" บันทึกเป็นสถานะ NOT_FOUND · เหตุผลอื่นเป็น REJECTED

export const REJECT_REASONS = [
  "NO_MATCHING_RECORD",
  "IDENTITY_MISMATCH",
  "NOT_GRADUATED",
  "DEGREE_REVOKED",
  "INSUFFICIENT_INFORMATION",
  "OTHER",
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

export function statusForRejectReason(reason: RejectReason): "NOT_FOUND" | "REJECTED" {
  return reason === "NO_MATCHING_RECORD" ? "NOT_FOUND" : "REJECTED";
}

export function isRejectReason(value: unknown): value is RejectReason {
  return REJECT_REASONS.includes(value as RejectReason);
}
