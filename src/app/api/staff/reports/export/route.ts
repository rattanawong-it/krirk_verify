import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { PassThrough, Readable } from "node:stream";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/rbac";
import { hoursBetween, reportPeriod } from "@/lib/reports/range";
import {
  type ReportRow,
  iterateReportRows,
  recordReportExport,
} from "@/lib/services/report.service";
import { CSV_BOM, csvRow } from "@/lib/utils/csv";
import { getRequestContext } from "@/lib/utils/request-context";
import { reportExportSchema } from "@/lib/validations/report";

// F-RPT-07 — Export รายงานคำขอเป็น Excel หรือ CSV (เจ้าหน้าที่ · ตัวกรองเดียวกับหน้า /staff/reports)
// Excel แสดงหัวคอลัมน์และค่าสถานะตามภาษาที่เลือก · CSV ใช้รหัสค่าเพื่อนำไปวิเคราะห์ต่อ

const COLUMNS = [
  "refNo",
  "createdAt",
  "organization",
  "purpose",
  "searchType",
  "status",
  "decisionType",
  "decidedAt",
  "reviewHours",
  "reviewReason",
  "faculty",
  "educationLevel",
  "degree",
] as const;

const BANGKOK_OFFSET_MS = 7 * 3_600_000;

function bangkokText(date: Date | null): string {
  if (!date) return "";
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

// Excel ไม่มี time zone — เลื่อนเป็นเวลาไทยเพื่อให้เซลล์แสดงเวลาท้องถิ่น
function bangkokCell(date: Date | null): Date | null {
  return date ? new Date(date.getTime() + BANGKOK_OFFSET_MS) : null;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isStaffRole(user.role)) return Response.json({ error: "forbidden" }, { status: 403 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const query = reportExportSchema.parse(params);
  const locale = params.lang === "en" ? "en" : "th";
  const now = new Date();
  const period = reportPeriod(query.from, query.to, now);
  recordReportExport(user.id, query, await getRequestContext(), now);

  const filename = `verification-report-${period.fromKey}-to-${period.toKey}.${query.format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  if (query.format === "csv") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(CSV_BOM + csvRow([...COLUMNS])));
        try {
          for await (const batch of iterateReportRows(query, now)) {
            controller.enqueue(
              encoder.encode(
                batch
                  .map((row) =>
                    csvRow([
                      row.refNo,
                      bangkokText(row.createdAt),
                      row.organization?.nameTh,
                      row.purpose,
                      row.searchType,
                      row.status,
                      row.decisionType,
                      bangkokText(row.decidedAt),
                      hoursBetween(row.createdAt, row.decidedAt),
                      row.reviewReason,
                      row.result?.facultyTh,
                      row.result?.educationLevel,
                      row.result?.degreeNameTh,
                    ]),
                  )
                  .join(""),
              ),
            );
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    return new Response(stream, {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  const t = await getTranslations({ locale, namespace: "reports" });
  const tv = await getTranslations({ locale, namespace: "verify" });
  const pass = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: true });

  const label = (row: ReportRow) => ({
    organization:
      locale === "en"
        ? (row.organization?.nameEn ?? row.organization?.nameTh)
        : row.organization?.nameTh,
    faculty:
      locale === "en" ? (row.result?.facultyEn ?? row.result?.facultyTh) : row.result?.facultyTh,
    degree:
      locale === "en"
        ? (row.result?.degreeNameEn ?? row.result?.degreeNameTh)
        : row.result?.degreeNameTh,
  });

  void (async () => {
    try {
      const sheet = workbook.addWorksheet(t("sheetName"), {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      sheet.columns = COLUMNS.map((key) => ({
        header: t(`columns.${key}`),
        key,
        width: key === "organization" || key === "degree" ? 36 : key === "faculty" ? 26 : 16,
        style:
          key === "createdAt" || key === "decidedAt" ? { numFmt: "yyyy-mm-dd hh:mm" } : undefined,
      }));
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).commit();

      for await (const batch of iterateReportRows(query, now)) {
        for (const row of batch) {
          const names = label(row);
          sheet
            .addRow({
              refNo: row.refNo,
              createdAt: bangkokCell(row.createdAt),
              organization: names.organization ?? "",
              purpose: tv(`purposes.${row.purpose}`),
              searchType: tv(`searchTypes.${row.searchType}`),
              status: tv(`statuses.${row.status}`),
              decisionType: row.decisionType ? tv(`decisions.${row.decisionType}`) : "",
              decidedAt: bangkokCell(row.decidedAt),
              reviewHours: hoursBetween(row.createdAt, row.decidedAt),
              reviewReason: row.reviewReason ?? "",
              faculty: names.faculty ?? "",
              educationLevel: row.result?.educationLevel ?? "",
              degree: names.degree ?? "",
            })
            .commit();
        }
      }
      sheet.commit();
      await workbook.commit();
    } catch (error) {
      pass.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return new Response(Readable.toWeb(pass) as ReadableStream<Uint8Array>, {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
