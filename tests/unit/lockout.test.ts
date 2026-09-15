import { describe, expect, it } from "vitest";
import {
  isLocked,
  registerFailedAttempt,
  remainingLockMinutes,
  type LockoutState,
} from "@/lib/auth/lockout";

const config = { maxAttempts: 5, lockMinutes: 30 };
const now = new Date("2026-09-14T10:00:00+07:00");
const fresh: LockoutState = { failedLoginCount: 0, lockedUntil: null };

describe("lockout", () => {
  it("ยังไม่ล็อกเมื่อผิดน้อยกว่ากำหนด", () => {
    let state: LockoutState = fresh;
    for (let i = 0; i < 4; i++) state = registerFailedAttempt(state, now, config);
    expect(state.failedLoginCount).toBe(4);
    expect(isLocked(state, now)).toBe(false);
  });

  it("ล็อก 30 นาทีเมื่อผิดครบ 5 ครั้ง", () => {
    const next = registerFailedAttempt({ failedLoginCount: 4, lockedUntil: null }, now, config);
    expect(next.justLocked).toBe(true);
    expect(isLocked(next, now)).toBe(true);
    expect(remainingLockMinutes(next, now)).toBe(30);
    expect(isLocked(next, new Date(now.getTime() + 30 * 60_000))).toBe(false);
  });

  it("เริ่มนับใหม่หลังการล็อกหมดอายุ", () => {
    const expired: LockoutState = {
      failedLoginCount: 5,
      lockedUntil: new Date(now.getTime() - 1000),
    };
    const next = registerFailedAttempt(expired, now, config);
    expect(next.failedLoginCount).toBe(1);
    expect(next.lockedUntil).toBeNull();
    expect(next.justLocked).toBe(false);
  });

  it("เวลาที่เหลือปัดขึ้นเป็นนาที", () => {
    const state: LockoutState = {
      failedLoginCount: 5,
      lockedUntil: new Date(now.getTime() + 61_000),
    };
    expect(remainingLockMinutes(state, now)).toBe(2);
  });
});
