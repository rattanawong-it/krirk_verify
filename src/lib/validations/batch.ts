import { z } from "zod";
import { consentField } from "./auth";
import { REQUEST_PURPOSES } from "./verification";

// F-BAT-03 — ข้อมูลที่ผู้ขอยืนยันพร้อมไฟล์ (วัตถุประสงค์ + PDPA consent เหมือนคำขอเดี่ยว)

export const batchUploadSchema = z.object({
  purpose: z.enum(REQUEST_PURPOSES, "validation.required"),
  consent: consentField,
});

export type BatchUploadInput = z.input<typeof batchUploadSchema>;
export type BatchUploadData = z.output<typeof batchUploadSchema>;

export const batchIdSchema = z.object({ batchId: z.string().trim().min(1).max(40) });

export const batchListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type BatchListQuery = z.output<typeof batchListQuerySchema>;
