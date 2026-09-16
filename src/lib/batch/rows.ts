import { maskCitizenId, maskPassportNo } from "@/lib/crypto";
import {
  isValidPassportNo,
  isValidThaiCitizenId,
  stripIdentifier,
} from "@/lib/validations/identifiers";

// F-BAT-02 / F-BAT-03 — ตรวจไฟล์แบบชุดทีละแถว
// ฟังก์ชันล้วนทั้งไฟล์ (ไม่แตะฐานข้อมูล/ไฟล์) เพื่อให้เขียน unit test ครอบคลุมทุกสาขาได้
// รูปแบบไฟล์ตามดีไซน์ project-ui/2: คอลัมน์ search_type และ search_value

export const BATCH_MAX_ROWS = 500;
export const BATCH_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const BATCH_COLUMNS = ["search_type", "search_value"] as const;
export const BATCH_ACCEPTED_EXTENSIONS = [".csv", ".xlsx"] as const;

export type BatchSearchType = "CITIZEN_ID" | "PASSPORT";

export type BatchRowErrorCode =
  "missingValue" | "unknownType" | "invalidCitizenId" | "invalidPassport" | "duplicate";

export type ParsedBatchRow =
  | { ok: true; rowNo: number; searchType: BatchSearchType; searchValue: string; masked: string }
  | { ok: false; rowNo: number; raw: string; errorCode: BatchRowErrorCode };

// หัวคอลัมน์จากไฟล์จริงมักมี BOM ช่องว่าง หรือพิมพ์ใหญ่ปนเล็ก
export function normalizeHeader(name: string): string {
  return name
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function hasRequiredColumns(headers: string[]): boolean {
  const normalized = headers.map(normalizeHeader);
  return BATCH_COLUMNS.every((column) => normalized.includes(column));
}

function normalizeType(value: string): BatchSearchType | null {
  const text = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (text === "CITIZEN_ID" || text === "CITIZENID") return "CITIZEN_ID";
  if (text === "PASSPORT" || text === "PASSPORT_NO") return "PASSPORT";
  return null;
}

// แสดงผลรายแถวโดยไม่เปิดเผยเลขเต็ม (PDPA ข้อ 4.5) — ใช้ตัวช่วยชุดเดียวกับคำขอเดี่ยว
function maskValue(searchType: BatchSearchType, value: string): string {
  return searchType === "CITIZEN_ID" ? maskCitizenId(value) : maskPassportNo(value);
}

// seen = คีย์ที่เคยพบในไฟล์เดียวกัน (ฟังก์ชันนี้เป็นผู้เพิ่มเข้าไปเมื่อแถวผ่าน)
export function validateBatchRow(
  rowNo: number,
  input: { searchType?: string | null; searchValue?: string | null },
  seen: Set<string>,
): ParsedBatchRow {
  const rawType = (input.searchType ?? "").trim();
  const rawValue = (input.searchValue ?? "").trim();
  const raw = rawValue.slice(0, 40);

  if (!rawValue) return { ok: false, rowNo, raw, errorCode: "missingValue" };

  const searchType = normalizeType(rawType);
  if (!searchType) return { ok: false, rowNo, raw, errorCode: "unknownType" };

  const searchValue = stripIdentifier(rawValue);
  if (searchType === "CITIZEN_ID" && !isValidThaiCitizenId(searchValue)) {
    return { ok: false, rowNo, raw, errorCode: "invalidCitizenId" };
  }
  if (searchType === "PASSPORT" && !isValidPassportNo(searchValue)) {
    return { ok: false, rowNo, raw, errorCode: "invalidPassport" };
  }

  // ยื่นซ้ำในไฟล์เดียวกันไม่มีประโยชน์ และกินโควตาของผู้ขอโดยเปล่าประโยชน์
  const key = `${searchType}:${searchValue}`;
  if (seen.has(key)) return { ok: false, rowNo, raw, errorCode: "duplicate" };
  seen.add(key);

  return { ok: true, rowNo, searchType, searchValue, masked: maskValue(searchType, searchValue) };
}

export type BatchParseOutcome = {
  rows: ParsedBatchRow[];
  validCount: number;
  invalidCount: number;
  truncated: boolean;
};

// รับข้อมูลที่ parse จากไฟล์แล้ว (CSV ผ่าน papaparse หรือ XLSX ผ่าน exceljs) มาตรวจทีละแถว
export function validateBatchRows(
  input: { searchType?: string | null; searchValue?: string | null }[],
): BatchParseOutcome {
  const seen = new Set<string>();
  const limited = input.slice(0, BATCH_MAX_ROWS);
  const rows = limited.map((row, index) => validateBatchRow(index + 1, row, seen));
  return {
    rows,
    validCount: rows.filter((row) => row.ok).length,
    invalidCount: rows.filter((row) => !row.ok).length,
    truncated: input.length > BATCH_MAX_ROWS,
  };
}

// F-BAT-02 — เนื้อหาเทมเพลตที่ผู้ขอดาวน์โหลดไปกรอก (ตัวอย่างตรงกับการ์ด "รูปแบบไฟล์" ในดีไซน์)
export function batchTemplateRows(): string[][] {
  return [[...BATCH_COLUMNS], ["CITIZEN_ID", "1234567890123"], ["PASSPORT", "AB123456"]];
}
