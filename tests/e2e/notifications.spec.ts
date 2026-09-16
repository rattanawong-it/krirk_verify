import "dotenv/config";
import { type Page, expect, test } from "@playwright/test";

// Phase 9 — Notifications · ใช้ข้อมูลจาก pnpm db:seed · ทดสอบบน desktop ตามลำดับ
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "การแจ้งเตือนทดสอบบน desktop");
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}

async function setQueueDigest(page: Page, enabled: boolean) {
  await page.goto("/staff/settings");
  const toggle = page.getByLabel("ส่งสรุปคิวคำขอรายวันทางอีเมล");
  if ((await toggle.getAttribute("aria-checked")) !== String(enabled)) await toggle.click();
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await expect(page.getByText(/บันทึกการตั้งค่าแล้ว|ไม่มีค่าที่เปลี่ยนแปลง/).first()).toBeVisible();
}

test("กระดิ่งแจ้งเตือนเปิดได้ และไปหน้ารายการทั้งหมดได้ (F-NOT-05)", async ({ page }) => {
  await login(page, "registrar@krirk.ac.th");

  const bell = page.getByRole("button", { name: "การแจ้งเตือน" });
  await expect(bell).toBeVisible();
  await bell.click();

  // มีรายการแจ้งเตือน หรือแสดงสถานะว่าง — อย่างใดอย่างหนึ่งเสมอ
  const seeAll = page.getByRole("menuitem", { name: /ดูการแจ้งเตือนทั้งหมด/ });
  await expect(seeAll.or(page.getByText("ยังไม่มีการแจ้งเตือน"))).toBeVisible();
  await seeAll.click();

  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole("heading", { level: 1, name: "การแจ้งเตือน" })).toBeVisible();
});

test("ประวัติการส่งอีเมลเปิดได้เฉพาะผู้ดูแลระบบ (F-NOT-04)", async ({ page, browser }) => {
  // เจ้าหน้าที่ทะเบียนไม่ใช่ผู้ดูแล — ต้องถูกกัน
  await login(page, "registrar@krirk.ac.th");
  await page.goto("/staff/email-logs");
  await expect(page).toHaveURL(/\/forbidden$/);

  const context = await browser.newContext();
  const adminPage = await context.newPage();
  await login(adminPage, "admin@krirk.ac.th");
  await adminPage.goto("/staff/email-logs");
  await expect(
    adminPage.getByRole("heading", { level: 1, name: "ประวัติการส่งอีเมล" }),
  ).toBeVisible();
  await expect(adminPage.getByLabel("สถานะ")).toBeVisible();

  // อีเมลที่ระบบส่งระหว่างชุดทดสอบต้องถูกบันทึกไว้ (ถ้ายังไม่มีเลยให้แสดงสถานะว่าง)
  const rows = adminPage.getByRole("listitem");
  await expect(rows.first().or(adminPage.getByText("ไม่พบอีเมลตามเงื่อนไข"))).toBeVisible();
  await context.close();
});

test("cron ส่งซ้ำอีเมล: ต้องมี secret และคืนผลสรุป (F-NOT-04)", async ({ request }) => {
  expect((await request.post("/api/cron/email-retry")).status()).toBe(401);
  test.skip(CRON_SECRET.length < 16, "ยังไม่ได้ตั้ง CRON_SECRET ใน .env");

  const res = await request.post("/api/cron/email-retry", {
    headers: { "x-cron-secret": CRON_SECRET },
  });
  expect(res.status()).toBe(200);
  const outcome = (await res.json()) as { attempted: number; sent: number; failed: number };
  expect(outcome.attempted).toBeGreaterThanOrEqual(0);
  expect(outcome.sent + outcome.failed).toBeLessThanOrEqual(outcome.attempted);
});

test("สรุปคิวรายวัน: ต้องมี secret · ปิดอยู่ไม่ส่ง · เปิดแล้วส่งครั้งเดียวต่อวัน (F-NOT-03)", async ({
  browser,
  request,
}) => {
  expect((await request.post("/api/cron/queue-digest")).status()).toBe(401);
  test.skip(CRON_SECRET.length < 16, "ยังไม่ได้ตั้ง CRON_SECRET ใน .env");
  const headers = { "x-cron-secret": CRON_SECRET };

  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, "admin@krirk.ac.th");
  try {
    await setQueueDigest(page, false);
    expect(await (await request.post("/api/cron/queue-digest", { headers })).json()).toEqual({
      status: "disabled",
    });

    await setQueueDigest(page, true);
    const outcome = (await (await request.post("/api/cron/queue-digest", { headers })).json()) as {
      status: string;
      day?: string;
    };
    // คิวว่าง = empty · มีคำขอรอ = sent · วันนี้ส่งไปแล้ว = alreadySent
    expect(["sent", "empty", "alreadySent"]).toContain(outcome.status);
    expect(outcome.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    if (outcome.status === "sent") {
      await expect
        .poll(async () => {
          const res = await fetch(
            `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent("to:registrar@krirk.ac.th")}`,
          );
          const data = (await res.json()) as { messages: { Subject: string }[] };
          return data.messages.some((m) => m.Subject.startsWith("สรุปคิวคำขอประจำวัน"));
        })
        .toBe(true);
    }

    // เรียกซ้ำในวันเดียวกันต้องไม่ส่งซ้ำ
    const again = await request.post("/api/cron/queue-digest", { headers });
    expect(((await again.json()) as { status: string }).status).toBe("alreadySent");
  } finally {
    await setQueueDigest(page, true);
    await context.close();
  }
});
