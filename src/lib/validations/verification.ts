import { z } from "zod";
import { consentField, optionalText } from "./auth";
import { isValidPassportNo, isValidThaiCitizenId, stripIdentifier } from "./identifiers";

// F-VER-03 / F-VER-04 — schema เดียวกันทั้งฟอร์มฝั่ง client และ server action

export const SEARCH_TYPES = ["CITIZEN_ID", "PASSPORT"] as const;

export const REQUEST_PURPOSES = [
  "EMPLOYMENT",
  "FURTHER_STUDY",
  "GOVERNMENT_SERVICE",
  "BACKGROUND_CHECK",
  "OTHER",
] as const;

const requestDetails = {
  purpose: z.enum(REQUEST_PURPOSES, "validation.required"),
  requesterReference: optionalText(50),
  note: optionalText(1000),
  consent: consentField,
};

// หน่วยงานภายนอก — ค้นด้วยเลขบัตร/พาสปอร์ตของผู้ถูกตรวจสอบ
export const submitRequestSchema = z
  .object({
    searchType: z.enum(SEARCH_TYPES),
    searchValue: z.string().transform(stripIdentifier),
    ...requestDetails,
  })
  .superRefine((data, ctx) => {
    const valid =
      data.searchType === "CITIZEN_ID"
        ? isValidThaiCitizenId(data.searchValue)
        : isValidPassportNo(data.searchValue);
    if (!valid) {
      ctx.addIssue({
        code: "custom",
        path: ["searchValue"],
        message: data.searchType === "CITIZEN_ID" ? "validation.citizenId" : "validation.passport",
      });
    }
  });

// ศิษย์เก่า — ตรวจสอบได้เฉพาะวุฒิของตนเอง (R-01) จึงไม่รับคีย์ค้นหาจากฟอร์ม
export const submitOwnRequestSchema = z.object(requestDetails);

export const requestListQuerySchema = z.object({
  status: z
    .enum(["PENDING_REVIEW", "APPROVED", "REJECTED", "NOT_FOUND"])
    .optional()
    .catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type SubmitRequestInput = z.input<typeof submitRequestSchema>;
export type SubmitRequestData = z.output<typeof submitRequestSchema>;
export type SubmitOwnRequestInput = z.input<typeof submitOwnRequestSchema>;
export type SubmitOwnRequestData = z.output<typeof submitOwnRequestSchema>;
