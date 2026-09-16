import type { NextRequest } from "next/server";
import { getHealth } from "@/lib/services/health.service";

// F-OPS-03 — GET /api/health
//   200 ok        ฐานข้อมูล + ระบบทะเบียนปกติ
//   200 degraded  ระบบทะเบียนเชื่อมต่อไม่ได้ (ยังค้นหาจากข้อมูลที่ sync ไว้ได้)
//   503 down      ฐานข้อมูลเชื่อมต่อไม่ได้
// ?registry=skip ตรวจเฉพาะฐานข้อมูล — ใช้กับ HEALTHCHECK ของ Docker ที่เรียกถี่ เพื่อไม่ยิง API ทะเบียนทุก 30 วินาที

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const includeRegistry = request.nextUrl.searchParams.get("registry") !== "skip";
  const { report, httpStatus } = await getHealth({ includeRegistry });
  return Response.json(report, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}
