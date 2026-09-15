// สีของกราฟอ้างอิง design token (CSS variable) — รองรับโหมดมืดโดยไม่ต้องกำหนดสีซ้ำ
// แยกจากไฟล์ "use client" เพื่อให้ server component อ่านค่าได้

export const TREND_COLORS = {
  approved: "var(--color-primary)",
  pending: "var(--color-status-pending)",
  negative: "var(--color-status-notfound)",
} as const;

export const STATUS_COLORS = {
  APPROVED: "var(--color-primary)",
  PENDING_REVIEW: "var(--color-status-pending)",
  NOT_FOUND: "var(--color-status-notfound)",
  REJECTED: "var(--color-status-rejected)",
} as const;
