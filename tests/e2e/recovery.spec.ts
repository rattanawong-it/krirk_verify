import "dotenv/config";
import { randomUUID } from "node:crypto";
import { type Page, expect, test } from "@playwright/test";
import { Client } from "pg";

// กู้คืนงานเบื้องหลังที่ค้าง + retention ของประวัติอีเมล
// จำลองสถานะ "process ถูกรีสตาร์ตกลางคัน" ด้วยการแก้ฐานข้อมูลตรง แล้วเรียก cron endpoint จริง
// ใช้ข้อมูลจาก pnpm db:seed · ต้องตั้ง DATABASE_URL และ CRON_SECRET ใน .env
// Prisma เก็บเวลาเป็น UTC ในคอลัมน์ timestamp ไม่มี timezone แต่ container ตั้ง TZ=Asia/Bangkok → ใช้ now() AT TIME ZONE 'utc'
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const headers = { "x-cron-secret": CRON_SECRET };

test.describe.configure({ mode: "serial" });

let db: Client;

test.beforeAll(async () => {
  // pg ไม่รู้จักพารามิเตอร์ ?schema= ของ Prisma
  db = new Client({ connectionString: process.env.DATABASE_URL?.split("?")[0] });
  await db.connect();
});

test.afterAll(async () => {
  await db?.end();
});

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "ทดสอบงานเบื้องหลังบน desktop");
  test.skip(CRON_SECRET.length < 16, "ยังไม่ได้ตั้ง CRON_SECRET ใน .env");
});

// เลขบัตรสุ่มที่ผ่าน checksum — ไม่ชนกับการรันครั้งก่อน
function randomCitizenId(): string {
  const first12 = `${1 + Math.floor(Math.random() * 8)}${String(Math.floor(Math.random() * 1e11)).padStart(11, "0")}`;
  const sum = [...first12].reduce((acc, digit, index) => acc + Number(digit) * (13 - index), 0);
  return `${first12}${(11 - (sum % 11)) % 10}`;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/, { timeout: 15_000 });
}

test("งานแบบชุดที่ค้าง PROCESSING ถูกทำต่อจนจบ และแถวที่ยื่นไปแล้วไม่ถูกยื่นซ้ำ", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const [alreadySubmitted, notYetSubmitted] = [randomCitizenId(), randomCitizenId()];

  expect((await page.request.post("/api/cron/batch-recovery")).status()).toBe(401);

  await login(page, "hr@thaihr.co.th");
  await page.goto("/batch");
  await expect(page.getByRole("heading", { level: 1, name: "ตรวจสอบแบบชุด" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="file"]').setInputFiles({
    name: "recovery-e2e.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "search_type,search_value",
        `CITIZEN_ID,${alreadySubmitted}`,
        `CITIZEN_ID,${notYetSubmitted}`,
      ].join("\n"),
    ),
  });
  await expect(page.getByText("recovery-e2e.csv").first()).toBeVisible();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "สมัครงาน" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "อัปโหลดและตรวจไฟล์" }).click();
  await expect(page).toHaveURL(/\/batch\/[\w-]+$/);
  const batchId = page.url().split("/").pop()!;

  // จำลอง: เริ่มประมวลผลเมื่อ 20 นาทีก่อน แล้ว process ดับ — ไม่มีแถวใดถูกบันทึกผล
  await db.query(
    `UPDATE batch_jobs SET status = 'PROCESSING', "startedAt" = (now() AT TIME ZONE 'utc') - interval '20 minutes',
       "updatedAt" = (now() AT TIME ZONE 'utc') - interval '20 minutes' WHERE id = $1`,
    [batchId],
  );

  // จำลอง: แถวแรกยื่นคำขอสำเร็จแล้วก่อน process ดับ (คำขอมีอยู่ แต่แถวยัง PENDING)
  await page.goto("/requests/new");
  await page.getByLabel("เลขบัตรประจำตัวประชาชน").fill(alreadySubmitted);
  await page.getByRole("combobox", { name: /วัตถุประสงค์การตรวจสอบ/ }).click();
  await page.getByRole("option", { name: "สมัครงาน" }).click();
  await page.getByRole("checkbox", { name: /ข้าพเจ้ามีเหตุอันควร/ }).click();
  await page.getByRole("button", { name: "ส่งคำขอตรวจสอบ" }).click();
  await expect(page).toHaveURL(/\/requests\/KRU-\d{4}-\d{6}\?submitted=1$/);
  const existingRefNo = page.url().match(/KRU-\d{4}-\d{6}/)![0];

  const res = await page.request.post("/api/cron/batch-recovery", { headers });
  expect(res.status()).toBe(202);
  expect(((await res.json()) as { jobIds: string[] }).jobIds).toContain(batchId);

  // รอบถัดไปไม่รับงานเดิมซ้ำ (ถูกจองไปแล้ว)
  const again = (await (
    await page.request.post("/api/cron/batch-recovery", { headers })
  ).json()) as {
    jobIds: string[];
  };
  expect(again.jobIds).not.toContain(batchId);

  await page.goto(`/batch/${batchId}`);
  await expect(page.getByRole("link", { name: "Export Excel" })).toBeVisible({ timeout: 30_000 });
  // แถวแรกผูกกับคำขอเดิม · แถวที่สองได้คำขอใหม่
  await expect(page.getByRole("link", { name: existingRefNo })).toBeVisible();
  await expect(page.getByRole("link", { name: /KRU-\d{4}-\d{6}/ })).toHaveCount(2);

  const job = await db.query(`SELECT status, "processedRows" FROM batch_jobs WHERE id = $1`, [
    batchId,
  ]);
  expect(job.rows[0]).toEqual({ status: "COMPLETED", processedRows: 2 });
  const requests = await db.query(
    `SELECT count(*)::int AS n FROM verification_requests r JOIN users u ON u.id = r."requesterId"
       WHERE u.email = 'hr@thaihr.co.th' AND r."createdAt" > (now() AT TIME ZONE 'utc') - interval '5 minutes'
       AND r."refNo" IN (SELECT "refNo" FROM batch_items WHERE "batchJobId" = $1)`,
    [batchId],
  );
  expect(requests.rows[0].n).toBe(2);
  const audit = await db.query(
    `SELECT count(*)::int AS n FROM audit_logs WHERE action = 'batch.recovered' AND "entityId" = $1`,
    [batchId],
  );
  expect(audit.rows[0].n).toBe(1);
});

test("อีเมลที่ค้างสถานะ PENDING ถูกเปลี่ยนเป็นส่งซ้ำในรอบ email-retry", async ({ request }) => {
  const sample = await db.query(
    `SELECT "to", template, subject, locale, payload FROM email_logs
       WHERE status = 'SENT' AND template = 'verifyEmail' LIMIT 1`,
  );
  test.skip(sample.rowCount === 0, "ยังไม่มีอีเมลตัวอย่างในฐานข้อมูล");
  const { to, template, subject, locale, payload } = sample.rows[0];

  const stuckId = `e2e-stuck-${randomUUID()}`;
  const freshId = `e2e-fresh-${randomUUID()}`;
  for (const [id, age] of [
    [stuckId, "40 minutes"],
    [freshId, "1 minute"],
  ]) {
    await db.query(
      `INSERT INTO email_logs (id, "to", template, subject, locale, status, attempts, payload, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'PENDING', 0, $6, (now() AT TIME ZONE 'utc') - $7::interval, now() AT TIME ZONE 'utc')`,
      [id, to, template, subject, locale, JSON.stringify(payload), age],
    );
  }

  const res = await request.post("/api/cron/email-retry", { headers });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { recovered: number }).recovered).toBeGreaterThanOrEqual(1);

  const rows = await db.query(`SELECT id, status, attempts FROM email_logs WHERE id = ANY($1)`, [
    [stuckId, freshId],
  ]);
  const byId = Object.fromEntries(rows.rows.map((row) => [row.id, row]));
  // ค้างเกิน 30 นาที → ถูกส่งซ้ำ (SENT ถ้า SMTP ทำงาน, FAILED พร้อมนับครั้งถ้าไม่)
  expect(byId[stuckId].status).not.toBe("PENDING");
  expect(byId[stuckId].attempts).toBeGreaterThanOrEqual(2);
  // เพิ่งสร้าง อาจกำลังส่งอยู่จริง → ไม่แตะ
  expect(byId[freshId]).toMatchObject({ status: "PENDING", attempts: 0 });

  await db.query(`DELETE FROM email_logs WHERE id = ANY($1)`, [[stuckId, freshId]]);
});

test("retention ลบประวัติอีเมลที่เก่ากว่าระยะเก็บ และคงฉบับที่ยังไม่ถึงกำหนด", async ({
  request,
}) => {
  const oldId = `e2e-old-${randomUUID()}`;
  const recentId = `e2e-recent-${randomUUID()}`;
  for (const [id, age] of [
    [oldId, "400 days"],
    [recentId, "10 days"],
  ]) {
    await db.query(
      `INSERT INTO email_logs (id, "to", template, subject, status, attempts, payload, "createdAt", "updatedAt")
         VALUES ($1, 'retention-e2e@example.com', 'verifyEmail', 'e2e', 'SENT', 1, '{}', (now() AT TIME ZONE 'utc') - $2::interval, now() AT TIME ZONE 'utc')`,
      [id, age],
    );
  }

  const res = await request.post("/api/cron/retention", { headers });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { emailDeleted: number }).emailDeleted).toBeGreaterThanOrEqual(1);

  const left = await db.query(`SELECT id FROM email_logs WHERE id = ANY($1)`, [[oldId, recentId]]);
  expect(left.rows.map((row) => row.id)).toEqual([recentId]);
  await db.query(`DELETE FROM email_logs WHERE id = $1`, [recentId]);
});

test("retention ลบงานแบบชุดที่พ้นระยะเก็บคำขอ และงานที่ไม่ได้ยืนยันเกิน 7 วัน", async ({
  request,
}) => {
  const owner = await db.query(`SELECT id FROM users WHERE email = 'hr@thaihr.co.th'`);
  const requesterId = owner.rows[0].id as string;
  // ระยะเก็บคำขอค่าเริ่มต้น 5 ปี
  const jobs = {
    oldCompleted: ["COMPLETED", "6 years"],
    oldProcessing: ["PROCESSING", "6 years"],
    staleDraft: ["DRAFT", "8 days"],
    freshDraft: ["DRAFT", "2 days"],
    recentCompleted: ["COMPLETED", "30 days"],
  } as const;
  const ids = Object.fromEntries(
    Object.keys(jobs).map((key) => [key, `e2e-batch-${key}-${randomUUID()}`]),
  ) as Record<keyof typeof jobs, string>;
  for (const [key, [status, age]] of Object.entries(jobs)) {
    await db.query(
      `INSERT INTO batch_jobs (id, "requesterId", "fileName", purpose, status, "consentAt", "createdAt", "updatedAt")
         VALUES ($1, $2, 'retention-e2e.csv', 'EMPLOYMENT', $3, (now() AT TIME ZONE 'utc') - $4::interval,
           (now() AT TIME ZONE 'utc') - $4::interval, now() AT TIME ZONE 'utc')`,
      [ids[key as keyof typeof jobs], requesterId, status, age],
    );
  }
  const itemId = `e2e-batch-item-${randomUUID()}`;
  await db.query(
    `INSERT INTO batch_items (id, "batchJobId", "rowNo", "searchValueMasked", "resultStatus")
       VALUES ($1, $2, 1, '1-xxxx-xxxxx-xx-1', 'INVALID')`,
    [itemId, ids.oldCompleted],
  );

  const res = await request.post("/api/cron/retention", { headers });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { batchDeleted: number }).batchDeleted).toBeGreaterThanOrEqual(2);

  const left = await db.query(`SELECT id FROM batch_jobs WHERE id = ANY($1)`, [Object.values(ids)]);
  expect(left.rows.map((row) => row.id).sort()).toEqual(
    [ids.oldProcessing, ids.freshDraft, ids.recentCompleted].sort(),
  );
  // แถวในไฟล์ถูกลบตามงาน
  const items = await db.query(`SELECT count(*)::int AS n FROM batch_items WHERE id = $1`, [
    itemId,
  ]);
  expect(items.rows[0].n).toBe(0);

  await db.query(`DELETE FROM batch_jobs WHERE id = ANY($1)`, [Object.values(ids)]);
});
