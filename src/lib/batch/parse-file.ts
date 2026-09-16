import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import {
  BATCH_MAX_FILE_BYTES,
  BATCH_MAX_ROWS,
  type BatchParseOutcome,
  hasRequiredColumns,
  normalizeHeader,
  validateBatchRows,
} from "./rows";

// F-BAT-03 — อ่านไฟล์ที่ผู้ขออัปโหลด (.csv ผ่าน papaparse · .xlsx ผ่าน exceljs) แล้วส่งต่อให้ตัวตรวจแถว
// อ่านไม่เกิน BATCH_MAX_ROWS + 1 แถว เพื่อรู้ว่าไฟล์ยาวเกินกำหนดโดยไม่ต้องโหลดทั้งไฟล์เข้าหน่วยความจำ

export type ParseFileErrorCode =
  "tooLarge" | "unsupportedType" | "missingColumns" | "empty" | "unreadable";

export type FileParseResult =
  { ok: true; outcome: BatchParseOutcome } | { ok: false; code: ParseFileErrorCode };

type RawRow = { searchType?: string | null; searchValue?: string | null };

const READ_LIMIT = BATCH_MAX_ROWS + 1;

// เซลล์ Excel อาจเป็นตัวเลข สูตร หรือข้อความรวย — ดึงข้อความที่ผู้ใช้เห็นออกมาเสมอ
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text)
        .join("")
        .trim();
    }
  }
  return "";
}

function fromCsv(text: string): { headers: string[]; rows: RawRow[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  const headers = parsed.meta.fields ?? [];
  const rows = parsed.data.slice(0, READ_LIMIT).map((row) => ({
    searchType: row.search_type,
    searchValue: row.search_value,
  }));
  return { headers, rows };
}

async function fromXlsx(buffer: Buffer): Promise<{ headers: string[]; rows: RawRow[] }> {
  const workbook = new ExcelJS.Workbook();
  // ชนิด Buffer ของ @types/node ใหม่กว่าที่ exceljs ประกาศไว้ (ข้อมูลโครงสร้างเดียวกัน)
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    headers[columnNumber - 1] = normalizeHeader(cellText(cell.value));
  });
  const typeIndex = headers.indexOf("search_type");
  const valueIndex = headers.indexOf("search_value");
  if (typeIndex < 0 || valueIndex < 0) return { headers, rows: [] };

  const rows: RawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rows.length >= READ_LIMIT) return;
    const searchType = cellText(row.getCell(typeIndex + 1).value);
    const searchValue = cellText(row.getCell(valueIndex + 1).value);
    // ข้ามแถวว่างที่ Excel มักทิ้งไว้ท้ายไฟล์
    if (!searchType && !searchValue) return;
    rows.push({ searchType, searchValue });
  });
  return { headers, rows };
}

export async function parseBatchFile(file: File): Promise<FileParseResult> {
  if (file.size > BATCH_MAX_FILE_BYTES) return { ok: false, code: "tooLarge" };

  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv");
  const isXlsx = name.endsWith(".xlsx");
  if (!isCsv && !isXlsx) return { ok: false, code: "unsupportedType" };

  let parsed: { headers: string[]; rows: RawRow[] };
  try {
    parsed = isCsv
      ? fromCsv(await file.text())
      : await fromXlsx(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    console.error("[batch] อ่านไฟล์ไม่สำเร็จ", file.name, error);
    return { ok: false, code: "unreadable" };
  }

  if (!hasRequiredColumns(parsed.headers)) return { ok: false, code: "missingColumns" };
  if (parsed.rows.length === 0) return { ok: false, code: "empty" };
  return { ok: true, outcome: validateBatchRows(parsed.rows) };
}
