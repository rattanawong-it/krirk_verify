import { type Browser, type Page, expect, test } from "@playwright/test";

// Phase 7 — Audit, Admin & PDPA · ใช้ข้อมูลจาก pnpm db:seed · ทดสอบบน desktop ตามลำดับ
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "งานผู้ดูแลระบบทดสอบบน desktop");
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}

async function adminSession(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "admin@krirk.ac.th");
  return { context, page };
}

async function saveAnnouncement(page: Page, text: string) {
  await page.goto("/staff/settings");
  await page.getByLabel("ข้อความประกาศหน้าแรก (ไทย)").fill(text);
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await expect(page.getByText(/บันทึกการตั้งค่าแล้ว|ไม่มีค่าที่เปลี่ยนแปลง/)).toBeVisible();
}

test("ตั้งค่าระบบ: ข้อความประกาศแสดงบนหน้าแรก และบันทึกใน Audit Log", async ({ browser }) => {
  const { context, page } = await adminSession(browser);
  const notice = `ปิดปรับปรุงระบบ ${Date.now()}`;

  await saveAnnouncement(page, notice);
  await page.goto("/");
  await expect(page.getByRole("note")).toContainText(notice);

  // ค่าที่ขัดกันต้องไม่ถูกบันทึก
  await page.goto("/staff/settings");
  await page.getByLabel("เก็บคำขอไว้").fill("10");
  await page.getByLabel("เก็บ Audit Log ไว้").fill("5");
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await expect(page.getByText("ต้องเก็บ Audit Log ไม่น้อยกว่าระยะเก็บคำขอ")).toBeVisible();

  await page.goto("/staff/audit-logs?action=settings.changed&range=24h");
  await expect(
    page.getByRole("listitem").filter({ hasText: "เปลี่ยนการตั้งค่าระบบ" }).first(),
  ).toBeVisible();

  await saveAnnouncement(page, "");
  await page.goto("/");
  await expect(page.getByRole("note")).toHaveCount(0);
  await context.close();
});

test("จัดการผู้ใช้: สร้างเจ้าหน้าที่ → ได้อีเมลเชิญ → ระงับบัญชี", async ({ browser }) => {
  const { context, page } = await adminSession(browser);
  const email = `staff.${Date.now()}@krirk.ac.th`;
  const name = `เจ้าหน้าที่ทดสอบ ${Date.now()}`;

  await page.goto("/staff/users");
  await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่อ-นามสกุล").fill(name);
  await dialog.getByLabel("อีเมล").fill(email);
  await dialog.getByRole("button", { name: "สร้างบัญชีและส่งอีเมลเชิญ" }).click();
  await expect(page.getByText("สร้างบัญชีและส่งอีเมลเชิญแล้ว")).toBeVisible();

  await expect
    .poll(async () => {
      const response = await page.request.get(
        `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      );
      const body = (await response.json()) as { messages: { Subject: string }[] };
      return body.messages.map((message) => message.Subject);
    })
    .toContain("เชิญใช้งานระบบ Krirk Verify");

  await page.goto(`/staff/users?q=${encodeURIComponent(email)}`);
  await expect(page.getByRole("cell", { name: email })).toBeVisible();
  await page.getByRole("button", { name: `จัดการผู้ใช้ ${name}` }).click();
  await page.getByRole("menuitem", { name: "ระงับบัญชี" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ยืนยัน" }).click();
  await expect(page.getByText("ระงับบัญชีแล้ว")).toBeVisible();
  await expect(page.getByRole("cell", { name: "ระงับ", exact: true })).toBeVisible();

  // Audit log + export CSV ใช้ตัวกรองเดียวกัน
  await page.goto("/staff/audit-logs?action=user.suspended&range=24h");
  await expect(
    page.getByRole("listitem").filter({ hasText: "ระงับบัญชีผู้ใช้" }).first(),
  ).toBeVisible();
  const csv = await page.request.get(
    "/api/staff/audit-logs/export?action=user.suspended&range=24h",
  );
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toMatch(/^﻿created_at,action,actor_email/);
  await context.close();
});

test("เจ้าหน้าที่ทะเบียนเข้าหน้าผู้ดูแลระบบและ export ไม่ได้", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "registrar@krirk.ac.th");

  await page.goto("/staff/settings");
  await expect(page.getByRole("heading", { name: "ตั้งค่าระบบ" })).toHaveCount(0);
  const csv = await page.request.get("/api/staff/audit-logs/export");
  expect(csv.status()).toBe(403);
  await context.close();
});

test("หน้านโยบายสาธารณะสองภาษา และ security headers", async ({ page }) => {
  const response = await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("นโยบายความเป็นส่วนตัว");
  await expect(page.getByRole("heading", { name: /ระยะเวลาเก็บรักษาข้อมูล/ })).toBeVisible();
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");

  await page.goto("/en/terms");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Terms of service");
});
