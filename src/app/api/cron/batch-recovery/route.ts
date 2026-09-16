import { type NextRequest, after } from "next/server";
import { CRON_SECRET_HEADER, isValidCronSecret } from "@/lib/auth/cron-secret";
import { claimStaleBatches, executeBatch } from "@/lib/services/batch.service";

// ทำงานแบบชุดที่ค้างสถานะ PROCESSING ต่อ (process ถูกรีสตาร์ตระหว่างประมวลผล) — ตั้ง system cron ทุก 15 นาที
//   production: scripts/cron-run.sh batch-recovery — nginx ปิด /api/cron จากภายนอก (docs/operations/deployment.md)
// ตอบทันทีพร้อมจำนวนงานที่รับไปทำต่อ แล้วประมวลผลเบื้องหลังทีละงาน (แบบเดียวกับ /api/batch/[batchId]/start)

export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get(CRON_SECRET_HEADER), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobs = await claimStaleBatches();
  if (jobs.length > 0) {
    after(async () => {
      for (const { context, ...job } of jobs) await executeBatch(job, context);
    });
  }
  return Response.json(
    { resumed: jobs.length, jobIds: jobs.map((job) => job.id) },
    { status: jobs.length > 0 ? 202 : 200 },
  );
}
