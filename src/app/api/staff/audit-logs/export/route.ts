import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { iterateAuditLogs, recordAuditExport } from "@/lib/services/audit-log.service";
import { CSV_BOM, csvRow } from "@/lib/utils/csv";
import { getRequestContext } from "@/lib/utils/request-context";
import { auditQuerySchema } from "@/lib/validations/admin";

// F-AUD-04 — Export Audit Log เป็น CSV (ADMIN เท่านั้น · ใช้ตัวกรองเดียวกับหน้า /staff/audit-logs)
// proxy ไม่ครอบ /api จึงต้องตรวจสิทธิ์ที่นี่เอง

const HEADER = [
  "created_at",
  "action",
  "actor_email",
  "actor_name",
  "actor_role",
  "entity_type",
  "entity_id",
  "ip_address",
  "user_agent",
  "metadata",
];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return Response.json({ error: "forbidden" }, { status: 403 });

  const query = auditQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const now = new Date();
  recordAuditExport(user.id, query, await getRequestContext());

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvRow(HEADER)));
      try {
        for await (const batch of iterateAuditLogs(query, now)) {
          const chunk = batch
            .map((row) =>
              csvRow([
                row.createdAt,
                row.action,
                row.actor?.email,
                row.actor?.name,
                row.actor?.role,
                row.entityType,
                row.entityId,
                row.ipAddress,
                row.userAgent,
                row.metadata,
              ]),
            )
            .join("");
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  const stamp = now.toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
