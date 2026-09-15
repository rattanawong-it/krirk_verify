// F-AUTH-10: ล็อกบัญชีชั่วคราวเมื่อกรอกรหัสผ่านผิดเกินกำหนด

export type LockoutState = {
  failedLoginCount: number;
  lockedUntil: Date | null;
};

export type LockoutConfig = { maxAttempts: number; lockMinutes: number };

export function getLockoutConfig(): LockoutConfig {
  const maxAttempts = Number(process.env.AUTH_MAX_FAILED_LOGINS) || 5;
  const lockMinutes = Number(process.env.AUTH_LOCKOUT_MINUTES) || 30;
  return { maxAttempts, lockMinutes };
}

export function isLocked(state: LockoutState, now: Date): boolean {
  return !!state.lockedUntil && state.lockedUntil.getTime() > now.getTime();
}

export function remainingLockMinutes(state: LockoutState, now: Date): number {
  if (!isLocked(state, now) || !state.lockedUntil) return 0;
  return Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 60_000);
}

export function registerFailedAttempt(
  state: LockoutState,
  now: Date,
  config: LockoutConfig,
): LockoutState & { justLocked: boolean } {
  // ล็อกครั้งก่อนหมดอายุแล้ว → เริ่มนับใหม่
  const expired = !!state.lockedUntil && state.lockedUntil.getTime() <= now.getTime();
  const failedLoginCount = (expired ? 0 : state.failedLoginCount) + 1;

  if (failedLoginCount >= config.maxAttempts) {
    return {
      failedLoginCount,
      lockedUntil: new Date(now.getTime() + config.lockMinutes * 60_000),
      justLocked: true,
    };
  }
  return { failedLoginCount, lockedUntil: expired ? null : state.lockedUntil, justLocked: false };
}
