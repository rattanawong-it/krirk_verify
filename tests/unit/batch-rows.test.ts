import { describe, expect, it } from "vitest";
import {
  BATCH_MAX_ROWS,
  batchTemplateRows,
  hasRequiredColumns,
  normalizeHeader,
  validateBatchRow,
  validateBatchRows,
} from "@/lib/batch/rows";
import { isValidThaiCitizenId } from "@/lib/validations/identifiers";

// Phase 5 — F-BAT-02 / F-BAT-03 (ตัวตรวจแถวเป็นฟังก์ชันล้วน ทดสอบได้โดยไม่ต้องใช้ฐานข้อมูล)

// สร้างเลขบัตรที่ผ่าน checksum จากตัวเลข 12 หลัก เพื่อให้ fixture ถูกต้องโดยโครงสร้าง
function withCheckDigit(first12: string): string {
  const sum = [...first12].reduce((acc, digit, index) => acc + Number(digit) * (13 - index), 0);
  return `${first12}${(11 - (sum % 11)) % 10}`;
}

const VALID_ID = withCheckDigit("110123456789");
const ANOTHER_ID = withCheckDigit("320987654321");

function rowsOf(...values: [string, string][]) {
  return values.map(([searchType, searchValue]) => ({ searchType, searchValue }));
}

describe("หัวคอลัมน์ของไฟล์แบบชุด (F-BAT-02)", () => {
  it("ตัด BOM ช่องว่าง และตัวพิมพ์ใหญ่ออก", () => {
    expect(normalizeHeader("﻿ Search Type ")).toBe("search_type");
    expect(normalizeHeader("search-value")).toBe("search_value");
  });

  it("ต้องมีครบทั้งสองคอลัมน์", () => {
    expect(hasRequiredColumns(["search_type", "search_value"])).toBe(true);
    expect(hasRequiredColumns(["﻿Search Type", "Search Value", "note"])).toBe(true);
    expect(hasRequiredColumns(["search_value"])).toBe(false);
  });

  it("เทมเพลตมีหัวคอลัมน์ที่ระบบรับได้และตัวอย่างครบทั้งสองประเภท", () => {
    const [header, ...examples] = batchTemplateRows();
    expect(hasRequiredColumns(header!)).toBe(true);
    expect(examples.map((row) => row[0])).toEqual(["CITIZEN_ID", "PASSPORT"]);
  });
});

describe("ตรวจแถวทีละรายการ (F-BAT-03)", () => {
  it("fixture ที่ใช้ทดสอบผ่าน checksum จริง", () => {
    expect(isValidThaiCitizenId(VALID_ID)).toBe(true);
  });

  it("แถวที่ถูกต้องคืนค่า mask ไม่ใช่เลขเต็ม", () => {
    const row = validateBatchRow(1, { searchType: "citizen id", searchValue: VALID_ID }, new Set());
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.searchType).toBe("CITIZEN_ID");
    expect(row.searchValue).toBe(VALID_ID);
    expect(row.masked).toMatch(/^\d-\d{4}-xxxxx-xx-\d$/);
    expect(row.masked).not.toContain(VALID_ID);
  });

  it("รับพาสปอร์ตและตัดขีด/ช่องว่างในค่าที่กรอกมา", () => {
    const row = validateBatchRow(
      2,
      { searchType: "PASSPORT", searchValue: " ab123456 " },
      new Set(),
    );
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.searchType).toBe("PASSPORT");
    expect(row.masked).not.toBe(row.searchValue);
  });

  it("แยกเหตุผลของแถวที่ใช้ไม่ได้", () => {
    const seen = new Set<string>();
    expect(validateBatchRow(1, { searchType: "CITIZEN_ID", searchValue: "" }, seen)).toMatchObject({
      ok: false,
      errorCode: "missingValue",
    });
    expect(
      validateBatchRow(2, { searchType: "รหัสอื่น", searchValue: VALID_ID }, seen),
    ).toMatchObject({ ok: false, errorCode: "unknownType" });
    expect(
      validateBatchRow(3, { searchType: "CITIZEN_ID", searchValue: "1234567890123" }, seen),
    ).toMatchObject({ ok: false, errorCode: "invalidCitizenId" });
    expect(validateBatchRow(4, { searchType: "PASSPORT", searchValue: "!!" }, seen)).toMatchObject({
      ok: false,
      errorCode: "invalidPassport",
    });
  });

  it("แถวซ้ำในไฟล์เดียวกันไม่ถูกยื่นสองครั้ง (ไม่กินโควตาซ้ำ)", () => {
    const seen = new Set<string>();
    expect(validateBatchRow(1, { searchType: "CITIZEN_ID", searchValue: VALID_ID }, seen).ok).toBe(
      true,
    );
    expect(
      validateBatchRow(2, { searchType: "CITIZEN_ID", searchValue: VALID_ID }, seen),
    ).toMatchObject({ ok: false, errorCode: "duplicate" });
  });
});

describe("ตรวจทั้งไฟล์ (F-BAT-03)", () => {
  it("นับแถวที่ผ่านและไม่ผ่านแยกกัน", () => {
    const outcome = validateBatchRows(
      rowsOf(
        ["CITIZEN_ID", VALID_ID],
        ["PASSPORT", "AB123456"],
        ["CITIZEN_ID", "1"],
        ["CITIZEN_ID", ANOTHER_ID],
      ),
    );
    expect(outcome.validCount).toBe(3);
    expect(outcome.invalidCount).toBe(1);
    expect(outcome.truncated).toBe(false);
    expect(outcome.rows.map((row) => row.rowNo)).toEqual([1, 2, 3, 4]);
  });

  it("ตัดที่จำนวนแถวสูงสุดและรายงานว่าถูกตัด", () => {
    const many = Array.from({ length: BATCH_MAX_ROWS + 5 }, () => ({
      searchType: "PASSPORT",
      searchValue: "AB123456",
    }));
    const outcome = validateBatchRows(many);
    expect(outcome.rows).toHaveLength(BATCH_MAX_ROWS);
    expect(outcome.truncated).toBe(true);
  });
});
