// F-VER-05 — กฎ auto-approve ตาม spec ข้อ 4.2 (pure function เพื่อ unit test ได้ทุกสาขา)
// ผ่านครบทุกข้อ → AUTO_APPROVE · ไม่ผ่านข้อใดข้อหนึ่ง → REVIEW พร้อมเหตุผลให้เจ้าหน้าที่

export const REVIEW_REASONS = [
  "NO_MATCH",
  "MULTIPLE_MATCHES",
  "MANUAL_FLAG",
  "NOT_GRADUATED",
  "INCOMPLETE_RECORD",
  "AUTO_APPROVE_DISABLED",
] as const;

export type ReviewReason = (typeof REVIEW_REASONS)[number];

export type MatchCandidate = {
  id: string;
  status: "GRADUATED" | "STUDYING" | "WITHDRAWN" | "REVOKED";
  graduationDate: Date | null;
  councilApprovalDate: Date | null;
  graduationTerm: string | null;
  // null = ยังดึงรายละเอียด (ชื่อไทย/GPAX) จากต้นทางไม่ครบ
  detailSyncedAt: Date | null;
  requiresManualReview: boolean;
};

export type DecisionOptions = {
  autoApproveEnabled: boolean;
  // ต้นทางส่งวันสภาอนุมัติปริญญา (RegistryClient.capabilities.councilApprovalDate)
  // true = กฎเดิมตาม spec ข้อ 4.2 · false (Keystone ปัจจุบัน) = ใช้ภาคที่สำเร็จแทนวันที่ และต้องมีรายละเอียดครบ
  requireCouncilApproval: boolean;
};

export function hasCompleteRecord(
  candidate: MatchCandidate,
  { requireCouncilApproval }: Pick<DecisionOptions, "requireCouncilApproval">,
): boolean {
  if (requireCouncilApproval) {
    return Boolean(candidate.graduationDate && candidate.councilApprovalDate);
  }
  return Boolean(
    (candidate.graduationDate || candidate.graduationTerm) && candidate.detailSyncedAt,
  );
}

export type VerificationDecision =
  | { outcome: "AUTO_APPROVE"; studentId: string }
  // studentId = ระเบียนเดียวที่จับคู่ได้ (ให้เจ้าหน้าที่เห็นทันที) · null เมื่อไม่พบหรือพบหลายรายการ
  | { outcome: "REVIEW"; reason: ReviewReason; studentId: string | null };

export function decideVerification(
  candidates: readonly MatchCandidate[],
  options: DecisionOptions,
): VerificationDecision {
  // ข้อ 1 (exact match) รับประกันโดยการค้นด้วย HMAC ของคีย์ — ฟังก์ชันนี้ได้เฉพาะรายการที่ตรงทุกตัวอักษร
  const [only, ...rest] = candidates;
  if (!only) return { outcome: "REVIEW", reason: "NO_MATCH", studentId: null };
  if (rest.length > 0) return { outcome: "REVIEW", reason: "MULTIPLE_MATCHES", studentId: null };

  const review = (reason: ReviewReason) =>
    ({ outcome: "REVIEW", reason, studentId: only.id }) as const;

  // ข้อ 4 ก่อนข้อ 3 — ระเบียนที่ถูกตั้งธง (เพิกถอน/ข้อพิพาท/ข้อมูลเก่า) ต้องแสดงเหตุผลนี้ให้เจ้าหน้าที่เห็นก่อน
  if (only.requiresManualReview) return review("MANUAL_FLAG");
  if (only.status !== "GRADUATED") return review("NOT_GRADUATED");
  if (!hasCompleteRecord(only, options)) return review("INCOMPLETE_RECORD");
  if (!options.autoApproveEnabled) return review("AUTO_APPROVE_DISABLED");

  return { outcome: "AUTO_APPROVE", studentId: only.id };
}
