import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

// F-UX-10 — ตรวจ WCAG 2.1 A/AA อัตโนมัติด้วย axe (รวม color-contrast) · ใช้ข้อมูลจาก pnpm db:seed
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "ผลของ axe ไม่ขึ้นกับขนาดจอ — ตรวจบน desktop ครั้งเดียว",
  );
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/, { timeout: 15_000 });
}

async function expectAccessible(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  // รอ animation ของ tw-animate-css จบ — ระหว่าง fade-in สีจะจางและ axe วัด contrast ผิด
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));
  // soft — รายงานครบทุกหน้าในรอบเดียว แทนการหยุดที่หน้าแรกที่ไม่ผ่าน
  expect.soft(summary, `${path} ไม่ผ่าน WCAG AA`).toEqual([]);
}

test("หน้าสาธารณะผ่าน WCAG 2.1 AA (ไทย + อังกฤษ)", async ({ page }) => {
  for (const path of [
    "/",
    "/en",
    "/login",
    "/register/organization",
    "/register/alumni",
    "/forgot-password",
    "/privacy",
    "/terms",
  ]) {
    await expectAccessible(page, path);
  }
});

test("หน้าผู้ขอ (หน่วยงานภายนอก) ผ่าน WCAG 2.1 AA", async ({ page }) => {
  await login(page, "hr@thaihr.co.th");
  for (const path of [
    "/dashboard",
    "/requests",
    "/requests/new",
    "/batch",
    "/notifications",
    "/profile",
  ]) {
    await expectAccessible(page, path);
  }
});

test("หน้าเจ้าหน้าที่และผู้ดูแลระบบผ่าน WCAG 2.1 AA", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "admin@krirk.ac.th");
  for (const path of [
    "/staff/dashboard",
    "/staff/queue",
    "/staff/students",
    "/staff/organizations",
    "/staff/reports",
    "/staff/sync",
    "/staff/audit-logs",
    "/staff/users",
    "/staff/settings",
    "/staff/email-logs",
  ]) {
    await expectAccessible(page, path);
  }
});

test.describe("โหมดมืด", () => {
  test.use({ colorScheme: "dark" });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  });

  test("หน้าหลักในโหมดมืดผ่าน WCAG 2.1 AA", async ({ page }) => {
    test.setTimeout(120_000);
    await expectAccessible(page, "/");
    await login(page, "admin@krirk.ac.th");
    await expect(page.locator("html")).toHaveClass(/(^| )dark( |$)/);
    for (const path of [
      "/staff/dashboard",
      "/staff/queue",
      "/staff/organizations",
      "/staff/settings",
    ]) {
      await expectAccessible(page, path);
    }
  });
});
