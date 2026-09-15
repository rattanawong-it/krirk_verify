import { type Browser, type Page, expect, test } from "@playwright/test";

// Phase 4 — งานเจ้าหน้าที่ทะเบียน · ใช้ข้อมูลจาก pnpm db:seed · ทดสอบบน desktop ตามลำดับ
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
// เลขบัตรผ่าน checksum แต่ไม่มีในข้อมูลทดสอบ → คำขอเข้าคิวเสมอ
const UNMATCHED_ID_FOR_APPROVE = "1111111111119";
const UNMATCHED_ID_FOR_REJECT = "2222222222227";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "งานเจ้าหน้าที่ทดสอบบน desktop");
});

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
}

async function newSession(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, email);
  // การตรวจรหัสผ่าน (hash) ใช้ ~1–2 วินาที เมื่อรันทั้งชุดบางครั้งเกิน 5 วินาทีของค่าเริ่มต้น
  await expect(page).toHaveURL(/dashboard$/, { timeout: 15_000 });
  return { context, page };
}

async function submitUnmatchedRequest(page: Page, citizenId: string): Promise<string> {
  await page.goto("/requests/new");
  await page.getByLabel("เลขบัตรประจำตัวประชาชน").fill(citizenId);
  await page.getByRole("combobox", { name: /วัตถุประสงค์การตรวจสอบ/ }).click();
  await page.getByRole("option", { name: "สมัครงาน" }).click();
  await page.getByRole("checkbox", { name: /ข้าพเจ้ามีเหตุอันควร/ }).click();
  await page.getByRole("button", { name: "ส่งคำขอตรวจสอบ" }).click();
  await expect(page).toHaveURL(/\/requests\/KRU-\d{4}-\d{6}\?submitted=1$/);
  return page.url().match(/KRU-\d{4}-\d{6}/)![0];
}

async function openReview(page: Page, refNo: string) {
  await page.goto("/staff/queue?sort=newest");
  await page.getByRole("link", { name: refNo }).first().click();
  await expect(page).toHaveURL(new RegExp(`/staff/queue/${refNo}$`));
  await expect(page.getByRole("heading", { name: "พิจารณาคำขอ" })).toBeVisible();
}

test("เจ้าหน้าที่ค้นหาด้วยตนเอง → บันทึกหมายเหตุ → ดูเลขเต็ม → อนุมัติ → ผู้ขอเห็นผล", async ({
  browser,
}) => {
  const requester = await newSession(browser, "hr@thaihr.co.th");
  const refNo = await submitUnmatchedRequest(requester.page, UNMATCHED_ID_FOR_APPROVE);

  const staff = await newSession(browser, "registrar@krirk.ac.th");
  const page = staff.page;
  await openReview(page, refNo);
  await expect(page.getByText("ไม่พบระเบียนที่ตรงกับคีย์ค้นหา").first()).toBeVisible();

  // F-REG-06 หมายเหตุภายใน
  const note = `รอเอกสารเพิ่มเติม ${Date.now()}`;
  await page.getByRole("button", { name: "หมายเหตุภายใน" }).click();
  await page.getByRole("textbox", { name: "เพิ่มหมายเหตุภายใน" }).fill(note);
  await page.getByRole("button", { name: "บันทึกหมายเหตุ" }).click();
  await expect(page.getByText(note)).toBeVisible();

  // ดูเลขเต็ม (บันทึก audit)
  await page.getByRole("button", { name: "ดูเลขเต็ม" }).click();
  await expect(page.getByText("1-1111-11111-11-9")).toBeVisible();

  // F-REG-03 ค้นหาด้วยตนเอง แล้วเลือกระเบียน
  await page.getByPlaceholder("รหัสนักศึกษา ชื่อ เลขบัตร หรือพาสปอร์ต…").fill("6112345679");
  await page.getByRole("button", { name: "ค้นหาด้วยตนเอง" }).click();
  await expect(page.getByText("นายธนากร วงศ์ใหญ่")).toBeVisible();
  await page.getByRole("radio").first().check();
  await expect(page.getByText("อนุมัติด้วยระเบียน 6112345679")).toBeVisible();

  // F-REG-04 อนุมัติ
  await page.getByRole("button", { name: "อนุมัติรายการที่เลือก" }).click();
  await expect(page.getByText("อนุมัติคำขอแล้ว และส่งอีเมลแจ้งผู้ขอ")).toBeVisible();
  await expect(page.getByRole("heading", { name: "ผลการตรวจสอบวุฒิการศึกษา" })).toBeVisible();
  // audit log เขียนแบบ non-blocking (F-AUD-01) — ไทม์ไลน์อาจยังไม่มีเหตุการณ์ในการ render ครั้งแรก
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("อนุมัติคำขอ", { exact: true })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await requester.page.goto(`/requests/${refNo}`);
  await expect(
    requester.page.getByRole("heading", { name: "ผลการตรวจสอบวุฒิการศึกษา" }),
  ).toBeVisible();
  await expect(requester.page.getByText("นายธนากร วงศ์ใหญ่")).toBeVisible();
  await expect(requester.page.getByText(note)).toHaveCount(0);

  await Promise.all([requester.context.close(), staff.context.close()]);
});

test("เจ้าหน้าที่ปฏิเสธด้วยเหตุผล 'ไม่พบข้อมูลที่ตรงกัน' → สถานะไม่พบข้อมูล และผู้ขอเห็นเหตุผล", async ({
  browser,
}) => {
  const requester = await newSession(browser, "hr@thaihr.co.th");
  const refNo = await submitUnmatchedRequest(requester.page, UNMATCHED_ID_FOR_REJECT);

  const staff = await newSession(browser, "registrar@krirk.ac.th");
  await openReview(staff.page, refNo);
  await staff.page.getByRole("button", { name: "ปฏิเสธคำขอ" }).click();
  await staff.page.getByRole("radio", { name: "ไม่พบข้อมูลที่ตรงกัน" }).check();
  await staff.page.getByRole("button", { name: "ยืนยันปฏิเสธ" }).click();
  await expect(staff.page.getByText("บันทึกการปฏิเสธแล้ว และส่งอีเมลแจ้งผู้ขอ")).toBeVisible();
  await expect(staff.page.getByText("คำขอนี้พิจารณาแล้ว")).toBeVisible();

  await requester.page.goto(`/requests/${refNo}`);
  await expect(
    requester.page.getByRole("heading", { name: "ไม่พบข้อมูลผู้สำเร็จการศึกษาที่ตรงกัน" }),
  ).toBeVisible();
  await expect(requester.page.getByText(/เหตุผล:\s*ไม่พบข้อมูลที่ตรงกัน/)).toBeVisible();

  await Promise.all([requester.context.close(), staff.context.close()]);
});

test("หน่วยงานลงทะเบียนใหม่ → เจ้าหน้าที่อนุมัติ → ผู้ใช้ของหน่วยงานเข้าสู่ระบบได้", async ({
  browser,
}) => {
  const runId = Date.now();
  const orgName = `บริษัท อนุมัติอีทูอี ${runId} จำกัด`;
  const orgEmail = `e2e-approve-${runId}@example.com`;
  const orgPassword = "E2eApprove2569";

  const guest = await browser.newContext();
  const page = await guest.newPage();
  await page.goto("/register/organization");
  await page.getByLabel(/ชื่อหน่วยงาน \(ไทย\)/).fill(orgName);
  await page.getByLabel(/เลขประจำตัวผู้เสียภาษี/).fill(
    String(runId + 7)
      .padStart(13, "0")
      .slice(-13),
  );
  await page.getByRole("combobox", { name: /ประเภทหน่วยงาน/ }).click();
  await page.getByRole("option", { name: "บริษัทเอกชน" }).click();
  await page.getByLabel(/^ที่อยู่/).fill("3 ซ.รามอินทรา 1 เขตบางเขน กรุงเทพฯ 10220");
  await page.getByLabel(/ชื่อผู้ติดต่อ/).fill("นายทดสอบ อนุมัติ");
  await page.getByLabel(/อีเมลองค์กร/).fill(orgEmail);
  await page.getByLabel(/เบอร์โทรศัพท์/).fill("02-970-5820");
  await page.getByLabel(/^รหัสผ่าน/).fill(orgPassword);
  await page.getByLabel(/^ยืนยันรหัสผ่าน/).fill(orgPassword);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ส่งคำขอลงทะเบียน" }).click();
  await expect(page).toHaveURL(/\/register\/check-email$/);

  // ยืนยันอีเมลจากลิงก์ใน Mailpit
  let verifyPath = "";
  await expect
    .poll(
      async () => {
        const res = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${orgEmail}"`)}`,
        );
        const data = (await res.json()) as { messages: { ID: string }[] };
        const id = data.messages[0]?.ID;
        if (!id) return "";
        const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as {
          Text: string;
        };
        const url = message.Text.match(/https?:\/\/\S+\/verify-email\?token=[\w-]+/)?.[0];
        verifyPath = url ? `${new URL(url).pathname}${new URL(url).search}` : "";
        return verifyPath;
      },
      { timeout: 20_000, intervals: [500, 1000, 2000] },
    )
    .toBeTruthy();
  await page.goto(verifyPath);
  await expect(page.getByText("สถานะหน่วยงาน: รออนุมัติ")).toBeVisible();

  const staff = await newSession(browser, "registrar@krirk.ac.th");
  await staff.page.goto("/staff/organizations?status=PENDING");
  const card = staff.page.locator("li", { hasText: orgName });
  await card.getByRole("button", { name: "อนุมัติ" }).click();
  await staff.page.getByRole("button", { name: "ยืนยัน" }).click();
  await expect(staff.page.getByText("อนุมัติหน่วยงานแล้ว")).toBeVisible();
  await expect(staff.page.locator("li", { hasText: orgName })).toHaveCount(0);

  await login(page, orgEmail, orgPassword);
  await expect(page).toHaveURL(/\/dashboard$/);

  await Promise.all([guest.close(), staff.context.close()]);
});
