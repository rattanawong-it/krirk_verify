import { type Page, expect, test } from "@playwright/test";

// ทดสอบ flow ที่ต้องผ่านอีเมลจริง — อ่านอีเมลจาก Mailpit (docker/docker-compose.yml)
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

const runId = Date.now();
const orgEmail = `e2e-org-${runId}@example.com`;
const taxId = String(runId).padStart(13, "0").slice(-13);
const firstPassword = "E2eFirst2569";
const newPassword = "E2eReset2569";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "email flow ทดสอบบน desktop");
});

type MailpitSummary = { ID: string; Subject: string; To: { Address: string }[] };

// รออีเมลที่หัวเรื่องตรงกัน แล้วคืน path ของลิงก์ในอีเมล (ตัด origin ออกเพื่อใช้กับ baseURL ของเทสต์)
async function linkFromEmail(to: string, subject: string, pathPrefix: string): Promise<string> {
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
        );
        const data = (await res.json()) as { messages: MailpitSummary[] };
        messageId = data.messages.find((m) => m.Subject.includes(subject))?.ID;
        return messageId;
      },
      { timeout: 20_000, intervals: [500, 1000, 2000] },
    )
    .toBeTruthy();

  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const message = (await res.json()) as { Text: string };
  const url = message.Text.match(new RegExp(`https?://\\S+${pathPrefix}\\?token=[\\w-]+`))?.[0];
  expect(url, "ลิงก์ในอีเมล").toBeTruthy();
  const parsed = new URL(url!);
  return `${parsed.pathname}${parsed.search}`;
}

function formAlert(page: Page, text: string | RegExp) {
  return page.getByRole("alert").filter({ hasText: text });
}

async function login(page: Page, email: string, password: string) {
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
}

test("ลงทะเบียนหน่วยงาน → ยืนยันอีเมลจากลิงก์ → รอเจ้าหน้าที่อนุมัติ", async ({ page }) => {
  await page.goto("/register/organization");
  await page.getByLabel(/ชื่อหน่วยงาน \(ไทย\)/).fill("บริษัท ทดสอบอีทูอี จำกัด");
  await page.getByLabel(/เลขประจำตัวผู้เสียภาษี/).fill(taxId);
  await page.getByRole("combobox", { name: /ประเภทหน่วยงาน/ }).click();
  await page.getByRole("option", { name: "บริษัทเอกชน" }).click();
  await page.getByLabel(/^ที่อยู่/).fill("1 ถนนทดสอบ เขตบางเขน กรุงเทพฯ 10220");
  await page.getByLabel(/ชื่อผู้ติดต่อ/).fill("นางสาวทดสอบ ระบบ");
  await page.getByLabel(/อีเมลองค์กร/).fill(orgEmail);
  await page.getByLabel(/เบอร์โทรศัพท์/).fill("02-970-5820");
  await page.getByLabel(/^รหัสผ่าน/).fill(firstPassword);
  await page.getByLabel(/^ยืนยันรหัสผ่าน/).fill(firstPassword);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ส่งคำขอลงทะเบียน" }).click();

  await expect(page).toHaveURL(/\/register\/check-email$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ตรวจสอบกล่องอีเมลของท่าน");
  await expect(page.getByText(orgEmail)).toBeVisible();

  const verifyPath = await linkFromEmail(orgEmail, "ยืนยันอีเมล", "/verify-email");
  await page.goto(verifyPath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ยืนยันอีเมลสำเร็จ");
  await expect(page.getByText("สถานะหน่วยงาน: รออนุมัติ")).toBeVisible();

  // เปิดลิงก์ซ้ำ (เช่น ระบบสแกนลิงก์เปิดไปก่อน) ยังแสดงผลสำเร็จ
  await page.goto(verifyPath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ยืนยันอีเมลสำเร็จ");

  await page.goto("/login");
  await login(page, orgEmail, firstPassword);
  await expect(formAlert(page, "รอเจ้าหน้าที่อนุมัติ")).toBeVisible();
});

test("ลืมรหัสผ่าน → ลิงก์ในอีเมล → ตั้งรหัสผ่านใหม่ → ใช้รหัสใหม่ได้", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("อีเมล").fill(orgEmail);
  await page.getByRole("button", { name: "ส่งลิงก์ตั้งรหัสผ่านใหม่" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "ลิงก์ตั้งรหัสผ่านใหม่ถูกส่งไปแล้ว" }),
  ).toBeVisible();

  const resetPath = await linkFromEmail(orgEmail, "ตั้งรหัสผ่านใหม่", "/reset-password");
  await page.goto(resetPath);
  await expect(page.getByText(orgEmail)).toBeVisible();
  await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(newPassword);
  await page.getByLabel("ยืนยันรหัสผ่านใหม่").fill(newPassword);
  await page.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }).click();

  await expect(page).toHaveURL(/\/login\?reason=passwordChanged$/);
  await expect(
    page.getByRole("status").filter({ hasText: "เปลี่ยนรหัสผ่านเรียบร้อย" }),
  ).toBeVisible();

  // ลิงก์เดิมใช้ซ้ำไม่ได้
  await page.goto(resetPath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุ",
  );

  await page.goto("/login");
  await login(page, orgEmail, firstPassword);
  await expect(formAlert(page, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
  await login(page, orgEmail, newPassword);
  await expect(formAlert(page, "รอเจ้าหน้าที่อนุมัติ")).toBeVisible();
});
