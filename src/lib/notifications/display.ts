import type { IconName } from "@/components/ui/icon";
import type { NotificationType } from "@/generated/prisma/client";

// F-NOT-05 — หน้าตาของการแจ้งเตือนแต่ละชนิด (ใช้ร่วมกันระหว่างกระดิ่งบน header และหน้ารายการ)
// ข้อความอยู่ในไฟล์แปล — ที่นี่เก็บเฉพาะไอคอนและสีตามดีไซน์ project-ui/3

export const NOTIFICATION_STYLE: Record<NotificationType, { icon: IconName; box: string }> = {
  QUEUE_NEW: { icon: "fileSearch", box: "bg-status-pending-bg text-status-pending" },
  SLA_BREACH: { icon: "alert", box: "bg-status-rejected-bg text-status-rejected" },
  ORG_PENDING: { icon: "building", box: "bg-status-info-bg text-status-info" },
  SYNC_FAILED: { icon: "sync", box: "bg-status-rejected-bg text-status-rejected" },
  REQUEST_APPROVED: { icon: "checkCircle", box: "bg-primary-soft text-primary" },
  REQUEST_REJECTED: { icon: "xCircle", box: "bg-status-rejected-bg text-status-rejected" },
};

export const NOTIFICATION_FALLBACK_HREF = "/notifications";

// ค่าที่ข้อความแปลอาจอ้างถึง — ส่งครบทุกตัวเสมอ ข้อความไหนไม่ใช้ก็ไม่เป็นไร
export function notificationValues(params: unknown): {
  refNo: string;
  orgName: string;
  errorCode: string;
  count: number;
} {
  const source = (params ?? {}) as Record<string, unknown>;
  const asText = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    refNo: asText(source.refNo),
    orgName: asText(source.orgName),
    errorCode: asText(source.errorCode),
    count: typeof source.count === "number" ? source.count : 0,
  };
}
