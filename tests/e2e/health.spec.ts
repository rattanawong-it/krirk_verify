import { expect, test } from "@playwright/test";

// F-OPS-03 — health check สำหรับ Docker / ระบบเฝ้าระวัง
test("GET /api/health ตรวจฐานข้อมูลและระบบทะเบียน และไม่ถูก cache", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(body.checks.database.status).toBe("up");
  expect(["up", "down"]).toContain(body.checks.registry.status);
  expect(["ok", "degraded"]).toContain(body.status);
});

test("GET /api/health?registry=skip ตรวจเฉพาะฐานข้อมูล", async ({ request }) => {
  const body = await (await request.get("/api/health?registry=skip")).json();
  expect(body).toMatchObject({ status: "ok", checks: { registry: { status: "skipped" } } });
});
