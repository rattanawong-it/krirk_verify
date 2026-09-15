import "dotenv/config";
import { expect, test } from "@playwright/test";

// ต้องรัน pnpm db:seed ก่อน · ทดสอบบน desktop ตามลำดับ เพราะงานซิงก์รันซ้อนกันไม่ได้ (lock ระดับฐานข้อมูล)
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "sync ทดสอบบน desktop");
});

test("Mock Registry API ตอบตามสัญญา (รายการ / รายคน / 404 / query ผิด)", async ({ request }) => {
  const list = await request.get("/api/mock/registry/students?page=1&pageSize=5");
  expect(list.ok()).toBe(true);
  const body = await list.json();
  expect(body.items).toHaveLength(5);
  expect(body.total).toBeGreaterThanOrEqual(200);
  expect(body.hasMore).toBe(true);

  const one = await request.get("/api/mock/registry/students/6012345678");
  expect(one.ok()).toBe(true);
  expect((await one.json()).firstNameEn).toBe("Siriporn");

  expect((await request.get("/api/mock/registry/students/0000000000")).status()).toBe(404);
  expect((await request.get("/api/mock/registry/students?pageSize=5000")).status()).toBe(400);
});

test("เจ้าหน้าที่สั่งซิงก์ทั้งหมด → เห็นความคืบหน้าและประวัติที่สำเร็จ", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill("registrar@krirk.ac.th");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/dashboard$/);

  await page.getByRole("link", { name: "ซิงก์ข้อมูล" }).first().click();
  await expect(page).toHaveURL(/\/staff\/sync$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "การซิงก์ข้อมูลทะเบียน" }),
  ).toBeVisible();
  await expect(page.getByText("MockRegistryClient")).toBeVisible();
  await expect(page.getByText("เชื่อมต่อได้")).toBeVisible();

  await page.getByRole("button", { name: "ซิงก์ทั้งหมดตอนนี้" }).click();
  await expect(page.getByText("เริ่มซิงก์ข้อมูลทั้งหมดแล้ว")).toBeVisible();

  await expect(page.getByText("ข้อมูลเป็นปัจจุบัน")).toBeVisible({ timeout: 30_000 });
  const latest = page.locator("table tbody tr").first();
  await expect(latest).toContainText("FULL");
  await expect(latest).toContainText("สำเร็จ");
  await expect(latest).toContainText("โดย เจ้าหน้าที่ทะเบียน ทดสอบ");
});

test("หน่วยงานภายนอกเข้าหน้า sync ไม่ได้", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill("hr@thaihr.co.th");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/staff/sync");
  await expect(page).toHaveURL(/\/forbidden$/);
});

test("cron endpoint ต้องมี secret ถูกต้อง และเริ่มงานได้", async ({ request }) => {
  expect((await request.post("/api/cron/sync")).status()).toBe(401);
  expect(
    (
      await request.post("/api/cron/sync", {
        headers: { "x-cron-secret": "wrong-secret-0123456789" },
      })
    ).status(),
  ).toBe(401);

  test.skip(CRON_SECRET.length < 16, "ยังไม่ได้ตั้ง CRON_SECRET ใน .env");
  const headers = { "x-cron-secret": CRON_SECRET };
  expect((await request.post("/api/cron/sync?type=weekly", { headers })).status()).toBe(400);

  const started = await request.post("/api/cron/sync?type=incremental", { headers });
  expect(started.status()).toBe(202);
  expect(await started.json()).toMatchObject({ type: "INCREMENTAL", status: "RUNNING" });
});
