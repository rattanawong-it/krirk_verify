import type { NextRequest } from "next/server";
import { z } from "zod";
import { generateMockStudents, queryMockStudents } from "@/lib/integrations/registry/mock-data";
import { guardMockRegistry } from "@/lib/integrations/registry/mock-server";

// GET /api/mock/registry/students?page=1&pageSize=100&updatedSince=2026-09-01T00:00:00Z

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(100),
  updatedSince: z.iso.datetime({ offset: true }).optional(),
});

export async function GET(request: NextRequest) {
  const denied = guardMockRegistry(request);
  if (denied) return denied;

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "invalid_query", issues: parsed.error.issues }, { status: 400 });
  }

  const { page, pageSize, updatedSince } = parsed.data;
  return Response.json(
    queryMockStudents(generateMockStudents(), {
      page,
      pageSize,
      updatedSince: updatedSince ? new Date(updatedSince) : undefined,
    }),
  );
}
