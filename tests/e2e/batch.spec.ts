import "dotenv/config";
import { type Page, expect, test } from "@playwright/test";

// Phase 5 — Batch Verification · ใช้ข้อมูลจาก pnpm db:seed · ทดสอบบน desktop ตามลำดับ
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "ตรวจสอบแบบชุดทดสอบบน desktop");
});

// เลขบัตรที่ผ่าน checksum — สร้างจากเลข 12 หลักเพื่อให้ fixture ถูกต้องโดยโครงสร้าง
function withCheckDigit(first12: string): string {
  const sum = [...first12].reduce((acc, digit, index) => acc + Number(digit) * (13 - index), 0);
  return `${first12}${(11 - (sum % 11)) % 10}`;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}

test("ดาวน์โหลดเทมเพลตได้ทั้ง CSV และ Excel (F-BAT-02)", async ({ page }) => {
  await login(page, "hr@thaihr.co.th");

  const csv = await page.request.get("/api/batch/template?format=csv");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("search_type,search_value");

  const xlsx = await page.request.get("/api/batch/template?format=xlsx");
  expect(xlsx.status()).toBe(200);
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");
});

test("อัปโหลดไฟล์ → ตัวอย่างก่อนยืนยัน → ประมวลผล → ผลลัพธ์รายแถว → export (F-BAT-03 ถึง 06)", async ({
  page,
}) => {
  await login(page, "hr@thaihr.co.th");
  await page.goto("/batch");
  await expect(page.getByRole("heading", { level: 1, name: "ตรวจสอบแบบชุด" })).toBeVisible();

  // สองแถวใช้ได้ (เลขบัตร + พาสปอร์ต) และหนึ่งแถวเลขบัตรผิด checksum
  const csv = [
    "search_type,search_value",
    `CITIZEN_ID,${withCheckDigit("110123450001")}`,
    "PASSPORT,AB123456",
    "CITIZEN_ID,1234567890123",
  ].join("\n");

  await page.locator('input[type="file"]').setInputFiles({
    name: "batch-e2e.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await expect(page.getByText("batch-e2e.csv")).toBeVisible();

  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "สมัครงาน" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "อัปโหลดและตรวจไฟล์" }).click();

  await expect(page).toHaveURL(/\/batch\/[\w-]+$/);
  await expect(page.getByText("แถวไม่ถูกต้อง").first()).toBeVisible();
  await expect(page.getByText("เลขบัตรประชาชนไม่ถูกต้อง")).toBeVisible();

  // ยืนยันแล้วประมวลผลเบื้องหลัง — รอจนปุ่ม export โผล่ (งานเสร็จ)
  await page.getByRole("button", { name: "ยืนยันและเริ่มตรวจสอบ" }).click();
  const exportLink = page.getByRole("link", { name: "Export Excel" });
  await expect(exportLink).toBeVisible({ timeout: 30_000 });

  // แถวที่ใช้ได้ต้องได้เลขอ้างอิงจริง และไฟล์ export เปิดได้
  await expect(page.getByRole("link", { name: /KRU-\d{4}-\d{6}/ }).first()).toBeVisible();
  const href = await exportLink.getAttribute("href");
  const xlsx = await page.request.get(href!);
  expect(xlsx.status()).toBe(200);
  const body = await xlsx.body();
  expect(body.subarray(0, 2).toString()).toBe("PK");
  // ไฟล์ผลลัพธ์ต้องไม่มีเลขบัตรเต็ม 13 หลัก (PDPA ข้อ 4.5)
  expect(body.toString("latin1")).not.toMatch(/\d{13}/);
});

test("เจ้าหน้าที่ทะเบียนเข้าหน้าตรวจสอบแบบชุดไม่ได้", async ({ page }) => {
  await login(page, "registrar@krirk.ac.th");
  await page.goto("/batch");
  await expect(page).toHaveURL(/\/forbidden$/);
  expect((await page.request.get("/api/batch/template?format=csv")).status()).toBe(403);
});
