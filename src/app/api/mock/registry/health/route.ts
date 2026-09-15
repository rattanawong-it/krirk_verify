import { guardMockRegistry } from "@/lib/integrations/registry/mock-server";

export async function GET(request: Request) {
  const denied = guardMockRegistry(request);
  if (denied) return denied;
  return Response.json({ status: "ok", service: "mock-registry" });
}
