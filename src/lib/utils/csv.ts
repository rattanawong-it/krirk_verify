// F-AUD-04 — สร้าง CSV สำหรับ Excel/ผู้ตรวจสอบภายนอก
// - ครอบค่าที่มี , " หรือขึ้นบรรทัดใหม่ด้วยเครื่องหมายคำพูด
// - กัน CSV/formula injection: ค่าที่ขึ้นต้นด้วย = + - @ tab หรือ CR จะเติม ' นำหน้า
// - ใส่ BOM เพื่อให้ Excel อ่านภาษาไทยเป็น UTF-8

export const CSV_BOM = "﻿";

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return `${values.map(csvCell).join(",")}\r\n`;
}
