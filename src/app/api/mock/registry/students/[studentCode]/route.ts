import type { NextRequest } from "next/server";
import { generateMockStudents } from "@/lib/integrations/registry/mock-data";
import { guardMockRegistry } from "@/lib/integrations/registry/mock-server";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/mock/registry/students/[studentCode]">,
) {
  const denied = guardMockRegistry(request);
  if (denied) return denied;

  const { studentCode } = await ctx.params;
  const student = generateMockStudents().find((s) => s.studentCode === studentCode);
  if (!student) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(student);
}
