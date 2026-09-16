import type { NextRequest } from "next/server";
import { CRON_SECRET_HEADER, isValidCronSecret } from "@/lib/auth/cron-secret";
import { sendQueueDigest } from "@/lib/services/notification.service";
import { getRequestContext } from "@/lib/utils/request-context";

// F-NOT-03 — สรุปคิวคำขอรายวันถึงเจ้าหน้าที่ (เรียกวันละครั้ง · เรียกซ้ำในวันเดียวกันจะไม่ส่งซ้ำ)
//   production: scripts/cron-run.sh queue-digest — nginx ปิด /api/cron จากภายนอก (docs/operations/deployment.md)

export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get(CRON_SECRET_HEADER), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const outcome = await sendQueueDigest(await getRequestContext());
  return Response.json(outcome);
}
