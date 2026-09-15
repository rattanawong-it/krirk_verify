import { type Page, expect, test } from "@playwright/test";

// ใช้บัญชีจาก prisma/seed.ts — ต้องรัน pnpm db:seed ก่อน
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";

// รันทีละเทสต์บน desktop เท่านั้น เพื่อไม่ให้ตัวนับรหัสผ่านผิดของบัญชีทดสอบถูกเพิ่มซ้ำจนบัญชีถูกล็อก
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "auth flow ทดสอบบน desktop");
});

async function login(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
}

test("ผู้ที่ยังไม่ล็อกอินถูกส่งไปหน้า login พร้อม callbackUrl", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard/);
  await expect(page.getByRole("heading", { level: 1, name: "เข้าสู่ระบบ" })).toBeVisible();
});

test("รหัสผ่านผิดแสดงข้อความกลาง ๆ ไม่บอกว่าบัญชีมีอยู่", async ({ page }) => {
  await page.goto("/login");
  await login(page, "pending@newcorp.co.th", "wrong-password-1");
  await expect(page.locator("form [role=alert]")).toContainText("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
});

test("หน่วยงานที่ยังไม่อนุมัติเข้าสู่ระบบไม่ได้", async ({ page }) => {
  await page.goto("/login");
  await login(page, "pending@newcorp.co.th");
  await expect(page.locator("form [role=alert]")).toContainText("รอเจ้าหน้าที่อนุมัติ");
});

test("หน่วยงานภายนอกเข้า portal ได้ แต่เข้าหน้าเจ้าหน้าที่ไม่ได้ และออกจากระบบได้", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page, "hr@thaihr.co.th");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("สวัสดี");

  await page.goto("/staff/dashboard");
  await expect(page).toHaveURL(/\/forbidden$/);
  await expect(page.getByText("403")).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: /นางสาวณัฐพร/ }).click();
  await page.getByRole("menuitem", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("เจ้าหน้าที่ทะเบียนถูกพาไปพื้นที่เจ้าหน้าที่", async ({ page }) => {
  await page.goto("/login");
  await login(page, "registrar@krirk.ac.th");
  await expect(page).toHaveURL(/\/staff\/dashboard$/);
});

test("กลับไปหน้าที่ขอไว้หลังล็อกอิน (callbackUrl)", async ({ page }) => {
  await page.goto("/profile");
  await login(page, "alumni@example.com");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { level: 1, name: "โปรไฟล์ของฉัน" })).toBeVisible();
});

test("ลงทะเบียนศิษย์เก่าตรวจ checksum เลขบัตรประชาชน", async ({ page }) => {
  await page.goto("/register/alumni");
  await page.getByLabel("รหัสนักศึกษา").fill("6112345679");
  await page.getByLabel("เลขบัตรประจำตัวประชาชน").fill("1234567890123");
  await page.getByRole("button", { name: "ยืนยันตัวตนและสร้างบัญชี" }).click();
  await expect(page.getByText("เลขบัตรประชาชนไม่ถูกต้องตาม checksum")).toBeVisible();
});

test("หน้า login ภาษาอังกฤษ", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
