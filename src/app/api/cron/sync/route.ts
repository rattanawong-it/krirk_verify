import { type NextRequest, after } from "next/server";
import { CRON_SECRET_HEADER, isValidCronSecret } from "@/lib/auth/cron-secret";
import { type BulkSyncType, executeBulkSync, startBulkSync } from "@/lib/services/sync.service";
import { getRequestContext } from "@/lib/utils/request-context";

// F-DATA-07: เรียกจาก system cron
//   curl -X POST -H "x-cron-secret: $CRON_SECRET" "https://verify.krirk.ac.th/api/cron/sync?type=full"
// ตอบ 202 ทันทีพร้อม jobId แล้ว sync ต่อเบื้องหลัง — ผลลัพธ์ดูได้ที่หน้า /staff/sync

const TYPES: Record<string, BulkSyncType> = { full: "FULL", incremental: "INCREMENTAL" };

export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get(CRON_SECRET_HEADER), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = TYPES[request.nextUrl.searchParams.get("type") ?? "full"];
  if (!type) {
    return Response.json({ error: "invalid_type", allowed: Object.keys(TYPES) }, { status: 400 });
  }

  const started = await startBulkSync(type, { actorId: null, context: await getRequestContext() });
  if (!started.ok) {
    return Response.json({ error: "already_running" }, { status: 409 });
  }

  after(() => executeBulkSync(started.job));
  return Response.json({ jobId: started.job.id, type, status: "RUNNING" }, { status: 202 });
}
