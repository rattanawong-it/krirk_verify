import "server-only";
import { isMockRegistryEnabled } from "./index";

// ตัวกันร่วมของ route /api/mock/registry/* — ปิดด้วย MOCK_REGISTRY_ENABLED และบังคับ API key ถ้าตั้งไว้
// (จำลองพฤติกรรม API จริงเพื่อให้ HttpRegistryClient ทดสอบกับ route นี้ได้ครบทุกเส้นทาง)

export function guardMockRegistry(request: Request): Response | null {
  if (!isMockRegistryEnabled()) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const apiKey = process.env.REGISTRY_API_KEY;
  if (apiKey && request.headers.get("authorization") !== `Bearer ${apiKey}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
