import { type NextRequest, after } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { executeBatch, startBatchProcessing } from "@/lib/services/batch.service";
import { loadViewer } from "@/lib/services/verification.service";
import { getRequestContext } from "@/lib/utils/request-context";

// F-BAT-04 — ยืนยันงานที่อัปโหลดไว้ แล้วตอบ 202 ทันที · ประมวลผลรายแถวต่อเบื้องหลังด้วย after()
// (แบบเดียวกับ /api/cron/sync ที่อนุมัติไว้ใน spec v1.3 — ไม่เพิ่ม worker service)

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/batch/[batchId]/start">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "EXTERNAL") return Response.json({ error: "forbidden" }, { status: 403 });

  const viewer = await loadViewer(user.id);
  if (!viewer) return Response.json({ error: "forbidden" }, { status: 403 });

  const { batchId } = await ctx.params;
  const job = await startBatchProcessing(batchId, viewer);
  // ไม่พบงาน หรือถูกกดยืนยันไปแล้ว — ทั้งสองกรณีไม่ควรเริ่มซ้ำ
  if (!job) return Response.json({ error: "alreadyStarted" }, { status: 409 });

  const context = await getRequestContext();
  after(() => executeBatch(job, context));
  return Response.json({ batchId: job.id, status: "PROCESSING" }, { status: 202 });
}
