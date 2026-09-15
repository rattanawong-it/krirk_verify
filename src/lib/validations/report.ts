import { z } from "zod";
import { DASHBOARD_RANGES } from "@/lib/reports/range";
import { REQUEST_PURPOSES } from "./verification";

// Phase 6 — query ของแดชบอร์ดและหน้ารายงาน · ค่าที่ผิดรูปแบบใน URL ถูกเพิกเฉย (ไม่ทำให้หน้าล้ม)

export const dashboardQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).catch("30d"),
});

export const REPORT_STATUSES = ["APPROVED", "PENDING_REVIEW", "NOT_FOUND", "REJECTED"] as const;
export const DECISION_TYPES = ["AUTO", "MANUAL"] as const;
export const REPORT_FORMATS = ["xlsx", "csv"] as const;

export const reportQuerySchema = z.object({
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  status: z.enum(REPORT_STATUSES).optional().catch(undefined),
  decision: z.enum(DECISION_TYPES).optional().catch(undefined),
  purpose: z.enum(REQUEST_PURPOSES).optional().catch(undefined),
  org: z
    .string()
    .regex(/^[a-z0-9]{8,40}$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const reportExportSchema = reportQuerySchema.extend({
  format: z.enum(REPORT_FORMATS).catch("xlsx"),
});
