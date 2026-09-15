import { type Page, expect, test } from "@playwright/test";

// Phase 8 — i18n, Responsive & Accessibility · ใช้ข้อมูลจาก pnpm db:seed
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("มือถือ: ผู้ดูแลระบบเปิดเมนูทั้งหมดจาก drawer และหน้าผู้ดูแลไม่มี horizontal scroll", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "ทดสอบ drawer บน viewport มือถือ");
  await login(page, "admin@krirk.ac.th");

  const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
  await nav.getByRole("button", { name: "เปิดเมนู" }).click();
  const drawer = page.getByRole("dialog", { name: "เมนู" });
  await expect(drawer.getByRole("link", { name: "Audit Log" })).toBeVisible();
  await drawer.getByRole("link", { name: "ตั้งค่าระบบ" }).click();
  await expect(page).toHaveURL(/\/staff\/settings$/);
  await expect(drawer).toBeHidden();

  for (const path of ["/staff/settings", "/staff/users", "/staff/audit-logs", "/staff/queue"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test("วันที่แสดงเป็น พ.ศ. ในภาษาไทย และ ค.ศ. ในภาษาอังกฤษ", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "ตรวจรูปแบบวันที่บน desktop");
  await login(page, "admin@krirk.ac.th");
  const year = new Date().getFullYear();

  // บรรทัดเวลาใต้แต่ละรายการ (IP · เบราว์เซอร์ · วันที่) — ไม่ตรวจทั้งรายการเพราะ metadata อาจมีตัวเลขปีอื่นปน
  const firstTimestamp = page.getByRole("listitem").locator("p.font-mono").first();

  await page.goto("/staff/audit-logs?range=24h");
  await expect(firstTimestamp).toContainText(String(year + 543));

  await page.goto("/en/staff/audit-logs?range=24h");
  await expect(firstTimestamp).toContainText(String(year));
  await expect(firstTimestamp).not.toContainText(String(year + 543));
});

test("ปุ่มสลับภาษาบนหน้า permalink เก็บรหัสเข้าถึง (?t=) ไว้", async ({ page }) => {
  await page.goto("/verify/result/KRU-2026-000001?t=not-a-real-token");
  await page.getByRole("button", { name: "EN" }).click();
  await expect(page).toHaveURL(/\/en\/verify\/result\/KRU-2026-000001\?t=not-a-real-token$/);
});

test("คีย์บอร์ด: ลิงก์ข้ามไปยังเนื้อหาหลักเป็นจุดแรกที่ focus ได้", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "ทดสอบคีย์บอร์ดบน desktop");
  await login(page, "registrar@krirk.ac.th");
  await page.goto("/staff/queue");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "ข้ามไปยังเนื้อหาหลัก" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
