import { type Page, expect, test } from "@playwright/test";

// ใช้ข้อมูลจาก pnpm db:seed (Mock Registry 240 ราย + บัญชีทดสอบ) · ทดสอบบน desktop ตามลำดับ
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";
// เลขบัตรผ่าน checksum แต่ไม่มีในข้อมูลทดสอบ
const UNKNOWN_CITIZEN_ID = "1234567890121";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "ยื่นคำขอทดสอบบน desktop");
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function fillPurposeAndConsent(page: Page) {
  await page.getByRole("combobox", { name: /วัตถุประสงค์การตรวจสอบ/ }).click();
  await page.getByRole("option", { name: "สมัครงาน" }).click();
  await page.getByRole("checkbox", { name: /ข้าพเจ้ามีเหตุอันควร/ }).click();
}

test("หน่วยงานยื่นคำขอที่ตรง 1 ราย → ได้ผลทันที → เปิด permalink ได้โดยไม่ต้องล็อกอิน", async ({
  page,
  browser,
}) => {
  await login(page, "hr@thaihr.co.th");
  await page.getByRole("link", { name: "ยื่นคำขอใหม่" }).first().click();
  await expect(page).toHaveURL(/\/requests\/new$/);

  await page.getByLabel("เลขบัตรประจำตัวประชาชน").fill("1101700230708");
  await expect(page.getByText("เลขบัตรถูกต้องตาม checksum 13 หลัก")).toBeVisible();
  await fillPurposeAndConsent(page);
  await page.getByRole("button", { name: "ส่งคำขอตรวจสอบ" }).click();

  await expect(page).toHaveURL(/\/requests\/KRU-\d{4}-\d{6}\?submitted=1$/);
  await expect(page.getByRole("heading", { name: "ผลการตรวจสอบวุฒิการศึกษา" })).toBeVisible();
  await expect(page.getByText("นางสาวศิริพร ใจดี")).toBeVisible();
  await expect(page.getByText("เกียรตินิยมอันดับหนึ่ง").first()).toBeVisible();

  const permalink = await page.getByRole("link", { name: "เปิด permalink" }).getAttribute("href");
  expect(permalink).toMatch(/\/verify\/result\/KRU-\d{4}-\d{6}\?t=/);

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(permalink!);
  await expect(guestPage.getByText("เปิดด้วยรหัสเข้าถึง")).toBeVisible();
  await expect(guestPage.getByText("6012345678")).toBeVisible();

  await guestPage.goto(permalink!.replace(/t=[^&]+/, "t=wrong-access-code"));
  await expect(
    guestPage.getByRole("heading", { name: "ไม่สามารถเปิดผลการตรวจสอบได้" }),
  ).toBeVisible();
  await expect(guestPage.getByText("6012345678")).toHaveCount(0);
  await guest.close();
});

test("เลขบัตรที่ไม่พบข้อมูล → เข้าคิวเจ้าหน้าที่ โดยไม่บอกผู้ขอว่าไม่พบ (F-VER-11)", async ({
  page,
}) => {
  await login(page, "hr@thaihr.co.th");
  await page.goto("/requests/new");
  await page.getByLabel("เลขบัตรประจำตัวประชาชน").fill(UNKNOWN_CITIZEN_ID);
  await fillPurposeAndConsent(page);
  await page.getByRole("button", { name: "ส่งคำขอตรวจสอบ" }).click();

  await expect(page).toHaveURL(/\/requests\/KRU-\d{4}-\d{6}\?submitted=1$/);
  await expect(page.getByRole("heading", { name: "คำขออยู่ระหว่างการพิจารณา" })).toBeVisible();
  await expect(page.getByText("ไม่พบข้อมูล")).toHaveCount(0);
  const refNo = page.url().match(/KRU-\d{4}-\d{6}/)![0];

  await page.goto("/requests?status=PENDING_REVIEW");
  const row = page.locator("tbody tr", { hasText: refNo });
  await expect(row).toContainText("รอยืนยันตัวบุคคล");
  await expect(row).toContainText("1-2345-xxxxx-xx-1");
  await expect(row).not.toContainText(UNKNOWN_CITIZEN_ID);
});

test("เลขบัตรผิด checksum ส่งไม่ได้", async ({ page }) => {
  await login(page, "hr@thaihr.co.th");
  await page.goto("/requests/new");
  await page.getByLabel("เลขบัตรประจำตัวประชาชน").fill("1101700230709");
  await fillPurposeAndConsent(page);
  await page.getByRole("button", { name: "ส่งคำขอตรวจสอบ" }).click();

  await expect(page.getByText("เลขบัตรประชาชนไม่ถูกต้องตาม checksum")).toBeVisible();
  await expect(page).toHaveURL(/\/requests\/new$/);
});

test("ศิษย์เก่าตรวจสอบวุฒิของตนเองได้โดยไม่ต้องกรอกเลขบัตร", async ({ page }) => {
  await login(page, "alumni@example.com");
  await page.goto("/requests/new");
  await expect(page.getByText("ระเบียนของท่าน")).toBeVisible();
  await expect(page.getByLabel("เลขบัตรประจำตัวประชาชน")).toHaveCount(0);

  await fillPurposeAndConsent(page);
  await page.getByRole("button", { name: "ส่งคำขอตรวจสอบ" }).click();
  await expect(page).toHaveURL(/\/requests\/KRU-\d{4}-\d{6}\?submitted=1$/);
  await expect(page.getByText("6012345678")).toBeVisible();
});
