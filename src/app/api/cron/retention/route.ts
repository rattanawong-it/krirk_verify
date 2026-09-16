import type { NextRequest } from "next/server";
import { CRON_SECRET_HEADER, isValidCronSecret } from "@/lib/auth/cron-secret";
import { runRetention } from "@/lib/services/retention.service";
import { getRequestContext } from "@/lib/utils/request-context";

// F-AUD-08 — เรียกจาก system cron วันละครั้ง
//   production: scripts/cron-run.sh retention — nginx ปิด /api/cron จากภายนอก (docs/operations/deployment.md)
// ทำงานเสร็จก่อนตอบกลับ (ปริมาณต่อวันไม่มาก) เพื่อให้ cron บันทึกผลลัพธ์ได้

export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get(CRON_SECRET_HEADER), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const run = await runRetention({ actorId: null, context: await getRequestContext() });
  return Response.json(run);
}
