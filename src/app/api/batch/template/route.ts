import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { batchTemplateRows } from "@/lib/batch/rows";
import { getCurrentUser } from "@/lib/auth/guards";
import { CSV_BOM, csvRow } from "@/lib/utils/csv";

// F-BAT-02 — เทมเพลตให้ผู้ขอดาวน์โหลดไปกรอก (CSV หรือ Excel)
// คอลัมน์ search_value ตั้งรูปแบบเป็นข้อความ เพื่อไม่ให้ Excel ตัดเลข 0 นำหน้าของเลขบัตร

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "EXTERNAL") return Response.json({ error: "forbidden" }, { status: 403 });

  const rows = batchTemplateRows();
  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const headers = {
    "Content-Disposition": `attachment; filename="krirk-verify-batch-template.${format}"`,
    "Cache-Control": "no-store",
  };

  if (format === "csv") {
    const body = CSV_BOM + rows.map((row) => csvRow(row)).join("");
    return new Response(body, {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("template");
  for (const row of rows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 26;
  sheet.getColumn(2).numFmt = "@";

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
