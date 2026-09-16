import { describe, expect, it } from "vitest";
import {
  BATCH_STALE_MINUTES,
  EMAIL_PENDING_STALE_MINUTES,
  staleBefore,
} from "@/lib/recovery/stale";

describe("เกณฑ์งานเบื้องหลังที่ค้าง", () => {
  const now = new Date("2026-09-16T10:00:00Z");

  it("ย้อนหลังตามจำนวนนาที", () => {
    expect(staleBefore(now, BATCH_STALE_MINUTES).toISOString()).toBe("2026-09-16T09:50:00.000Z");
    expect(staleBefore(now, EMAIL_PENDING_STALE_MINUTES).toISOString()).toBe(
      "2026-09-16T09:30:00.000Z",
    );
  });

  it("อีเมลต้องรอนานกว่า socket timeout ของ nodemailer (10 นาที) ก่อนถือว่าค้าง", () => {
    expect(EMAIL_PENDING_STALE_MINUTES).toBeGreaterThan(10);
  });
});
