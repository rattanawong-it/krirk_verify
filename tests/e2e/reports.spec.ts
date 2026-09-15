import "dotenv/config";
import { type Page, expect, test } from "@playwright/test";

// Phase 6 — Dashboard & Reports · ใช้ข้อมูลจาก pnpm db:seed (และคำขอที่ e2e ชุดอื่นสร้างไว้) · ทดสอบบน desktop ตามลำดับ
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "แดชบอร์ดและรายงานทดสอบบน desktop");
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}

async function setMonthlyReport(page: Page, enabled: boolean) {
  await page.goto("/staff/settings");
  const toggle = page.getByLabel("ส่งรายงานสรุปประจำเดือนทางอีเมล");
  if ((await toggle.getAttribute("aria-checked")) !== String(enabled)) await toggle.click();
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await expect(page.getByText(/บันทึกการตั้งค่าแล้ว|ไม่มีค่าที่เปลี่ยนแปลง/).first()).toBeVisible();
}

test("ผู้ขอเห็นแดชบอร์ดสรุปคำขอและเปิดคำขอล่าสุดได้ (F-RPT-01)", async ({ page }) => {
  await login(page, "hr@thaihr.co.th");
  await expect(page.getByRole("heading", { level: 1, name: /^สวัสดี/ })).toBeVisible();
  for (const name of ["คำขอทั้งหมด", "รอพิจารณา", "อนุมัติแล้ว", "คำขอล่าสุด"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }

  const recent = page.getByRole("link", { name: /KRU-\d{4}-\d{6}/ }).first();
  await expect(recent.or(page.getByText("ยังไม่มีคำขอ"))).toBeVisible();
  if (await recent.isVisible()) {
    await recent.click();
    await expect(page).toHaveURL(/\/requests\/KRU-\d{4}-\d{6}$/);
  }
});

test("แดชบอร์ดสถิติของเจ้าหน้าที่ และเปลี่ยนช่วงเวลาได้ (F-RPT-02 ถึง 05)", async ({ page }) => {
  await login(page, "registrar@krirk.ac.th");
  await expect(page.getByRole("heading", { level: 1, name: "แดชบอร์ดสถิติ" })).toBeVisible();
  for (const name of [
    "รอพิจารณาตอนนี้",
    "แนวโน้มคำขอ",
    "สัดส่วนตามสถานะ",
    "หน่วยงานที่ขอมากที่สุด",
    "จำแนกตามคณะ",
  ]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }

  const ranges = page.getByRole("navigation", { name: "ช่วงเวลา" });
  await expect(ranges.getByRole("link", { name: "30 วัน" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await ranges.getByRole("link", { name: "1 ปี" }).click();
  await expect(page).toHaveURL(/range=1y$/);
  await expect(page.getByText("แยกตามสถานะปัจจุบัน · 12 เดือนล่าสุด")).toBeVisible();
  await expect(ranges.getByRole("link", { name: "1 ปี" })).toHaveAttribute("aria-current", "page");
});

test("รายงาน: กรองตามเงื่อนไข แล้ว export Excel และ CSV พร้อมบันทึก audit (F-RPT-06/07)", async ({
  page,
  browser,
}) => {
  await login(page, "registrar@krirk.ac.th");
  await page.goto("/staff/reports");
  await expect(page.getByRole("heading", { level: 1, name: "รายงานคำขอตรวจสอบ" })).toBeVisible();

  await page.getByLabel("สถานะ").selectOption("APPROVED");
  await page.getByRole("button", { name: "แสดงรายงาน" }).click();
  await expect(page).toHaveURL(/status=APPROVED/);
  await expect(page.getByLabel("สถานะ")).toHaveValue("APPROVED");

  const xlsx = await page.request.get("/api/staff/reports/export?format=xlsx&status=APPROVED");
  expect(xlsx.status()).toBe(200);
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");

  const csv = await page.request.get("/api/staff/reports/export?format=csv");
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  expect(text).toMatch(/^﻿refNo,createdAt,organization,purpose/);
  // รายงานไม่มีเลขบัตรประชาชน (13 หลักติดกัน) ของผู้ถูกตรวจสอบ
  expect(text).not.toMatch(/\b\d{13}\b/);

  // หน้า Audit Log เปิดได้เฉพาะผู้ดูแลระบบ
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await login(adminPage, "admin@krirk.ac.th");
  await adminPage.goto("/staff/audit-logs?action=report.exported&range=24h");
  await expect(
    adminPage
      .getByRole("listitem")
      .filter({ hasText: "Export รายงานคำขอ" })
      .filter({ hasText: "REGISTRAR" })
      .first(),
  ).toBeVisible();
  await admin.close();
});

test("ผู้ขอภายนอกเข้าหน้ารายงานและ export ไม่ได้", async ({ page }) => {
  await login(page, "hr@thaihr.co.th");
  expect((await page.request.get("/api/staff/reports/export")).status()).toBe(403);
  await page.goto("/staff/reports");
  await expect(page).toHaveURL(/\/forbidden$/);
});

test("รายงานสรุปประจำเดือน: ต้องมี secret · ปิดอยู่ไม่ส่ง · เปิดแล้วส่งถึงผู้ดูแล (F-RPT-08)", async ({
  browser,
  request,
}) => {
  expect((await request.post("/api/cron/monthly-report")).status()).toBe(401);
  test.skip(CRON_SECRET.length < 16, "ยังไม่ได้ตั้ง CRON_SECRET ใน .env");
  const headers = { "x-cron-secret": CRON_SECRET };

  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "admin@krirk.ac.th");
  try {
    await setMonthlyReport(page, false);
    const disabled = await request.post("/api/cron/monthly-report", { headers });
    expect(await disabled.json()).toEqual({ status: "disabled" });

    await setMonthlyReport(page, true);
    const outcome = (await (
      await request.post("/api/cron/monthly-report", { headers })
    ).json()) as { status: string; month?: string };
    // เดือนเดียวกันส่งได้ครั้งเดียว — รันซ้ำจะได้ alreadySent
    expect(["sent", "alreadySent"]).toContain(outcome.status);
    expect(outcome.month).toMatch(/^\d{4}-\d{2}$/);

    if (outcome.status === "sent") {
      await expect
        .poll(async () => {
          const res = await fetch(
            `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent("to:admin@krirk.ac.th")}`,
          );
          const data = (await res.json()) as { messages: { Subject: string }[] };
          return data.messages.some((m) => m.Subject.startsWith("รายงานสรุปการตรวจสอบวุฒิ"));
        })
        .toBe(true);
    }
    const again = await request.post("/api/cron/monthly-report", { headers });
    expect((await again.json()).status).toBe("alreadySent");
  } finally {
    await setMonthlyReport(page, false);
    await context.close();
  }
});
