// F-REG-09 — ตัวชี้วัด SLA ของคำขอที่รอเจ้าหน้าที่พิจารณา
// ok = ปกติ · warn = ใช้เวลาไปแล้ว ≥ 75% ของ SLA · over = เกิน SLA

export type SlaLevel = "ok" | "warn" | "over";

const HOUR_MS = 60 * 60 * 1000;
const WARN_RATIO = 0.75;

export function reviewSlaHours(): number {
  const hours = Number(process.env.REVIEW_SLA_HOURS ?? 24);
  return Number.isFinite(hours) && hours > 0 ? hours : 24;
}

export function slaLevel(createdAt: Date, now: Date, slaHours: number): SlaLevel {
  const waitedHours = (now.getTime() - createdAt.getTime()) / HOUR_MS;
  if (waitedHours >= slaHours) return "over";
  if (waitedHours >= slaHours * WARN_RATIO) return "warn";
  return "ok";
}

// คำขอที่สร้างก่อนเวลานี้ = เกิน SLA (ใช้เป็นเงื่อนไขค้นหาในฐานข้อมูล)
export function slaCutoff(now: Date, slaHours: number): Date {
  return new Date(now.getTime() - slaHours * HOUR_MS);
}

export function waitParts(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

// รูปแบบย่อตามดีไซน์ตารางคิว: 26h 40m · 48m
export function formatWait(ms: number): string {
  const { hours, minutes } = waitParts(ms);
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}
