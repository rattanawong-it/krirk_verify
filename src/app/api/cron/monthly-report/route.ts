import type { NextRequest } from "next/server";
import { CRON_SECRET_HEADER, isValidCronSecret } from "@/lib/auth/cron-secret";
import { sendMonthlyReport } from "@/lib/services/report.service";
import { getRequestContext } from "@/lib/utils/request-context";

// F-RPT-08 — เรียกจาก system cron ต้นเดือน (ส่งสรุปของเดือนก่อนหน้า · เรียกซ้ำในเดือนเดียวกันจะไม่ส่งซ้ำ)
//   production: scripts/cron-run.sh monthly-report — nginx ปิด /api/cron จากภายนอก (docs/operations/deployment.md)

export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get(CRON_SECRET_HEADER), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const outcome = await sendMonthlyReport(await getRequestContext());
  return Response.json(outcome);
}
