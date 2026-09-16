import type { NextRequest } from "next/server";
import { CRON_SECRET_HEADER, isValidCronSecret } from "@/lib/auth/cron-secret";
import { retryEmails } from "@/lib/email/mailer";

// F-NOT-04 — ส่งซ้ำอีเมลที่ล้มเหลวและถึงกำหนดลองใหม่ (ตั้ง system cron ทุก 15 นาที)
//   curl -X POST -H "x-cron-secret: $CRON_SECRET" "https://verify.krirk.ac.th/api/cron/email-retry"

export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get(CRON_SECRET_HEADER), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const outcome = await retryEmails({ limit: 100 });
  return Response.json(outcome);
}
