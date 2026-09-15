import { expect, test } from "@playwright/test";

test("หน้าแรกโหลดได้ แสดงชื่อระบบ และไม่มี horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Krirk Verify/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalScroll).toBe(false);
});
