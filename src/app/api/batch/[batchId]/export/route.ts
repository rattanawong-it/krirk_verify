import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { displayStatus, getBatchJob, recordBatchExport } from "@/lib/services/batch.service";
import { loadViewer } from "@/lib/services/verification.service";
import { getRequestContext } from "@/lib/utils/request-context";

// F-BAT-06 — Export ผลลัพธ์รายแถวเป็น Excel
// ไฟล์มีเฉพาะคีย์ค้นหาแบบ mask (PDPA ข้อ 4.5) — ไม่มีเลขบัตรเต็มและไม่มีชื่อผู้ถูกตรวจสอบ

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/batch/[batchId]/export">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "EXTERNAL") return Response.json({ error: "forbidden" }, { status: 403 });

  const viewer = await loadViewer(user.id);
  if (!viewer) return Response.json({ error: "forbidden" }, { status: 403 });

  const { batchId } = await ctx.params;
  const job = await getBatchJob(batchId, viewer);
  if (!job) return Response.json({ error: "notFound" }, { status: 404 });

  const locale = _request.nextUrl.searchParams.get("lang") === "en" ? "en" : "th";
  const t = await getTranslations({ locale, namespace: "batch" });
  recordBatchExport(job.id, user.id, await getRequestContext());

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(t("rows"));
  sheet.columns = [
    { header: t("columns.row"), key: "rowNo", width: 10 },
    { header: t("columns.key"), key: "key", width: 26 },
    { header: t("columns.ref"), key: "refNo", width: 22 },
    { header: t("columns.status"), key: "status", width: 20 },
    { header: t("fileFormat"), key: "note", width: 34 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const item of job.items) {
    const status = displayStatus(item);
    sheet.addRow({
      rowNo: item.rowNo,
      key: item.searchValueMasked,
      refNo: item.refNo ?? "",
      status: t(`statuses.${status}`),
      note: item.errorCode ? t(`rowErrors.${item.errorCode}` as never) : "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Disposition": `attachment; filename="batch-${job.id}.xlsx"`,
      "Cache-Control": "no-store",
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
