import "server-only";
import { headers } from "next/headers";
import type { RequestContext } from "@/lib/services/audit.service";

// หลัง reverse proxy (nginx) IP จริงอยู่ตัวแรกของ x-forwarded-for
export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}
