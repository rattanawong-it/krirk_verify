import "server-only";
import { Pool } from "pg";
import { RateLimiterPostgres, RateLimiterRes } from "rate-limiter-flexible";
import { getSettings } from "./settings.service";

// F-VER-10 — rate limit เก็บใน PostgreSQL (ตาราง rate_limits สร้างผ่าน Prisma migration จึงตั้ง tableCreated)
// ใช้ connection pool แยกขนาดเล็ก เพราะไลบรารีต้องการ pg.Pool ไม่ใช่ Prisma client
// โควตามาจากหน้าตั้งค่าระบบ (F-AUD-06) — ผู้ดูแลเปลี่ยนค่าแล้วสร้าง limiter ชุดใหม่ แต้มที่ใช้ไปแล้วยังนับต่อ (key เดิม)

const HOUR_SECONDS = 60 * 60;
// ครั้งที่เปิด permalink ด้วยรหัสผิดต่อ IP ต่อชั่วโมง
const PERMALINK_FAILURES_PER_HOUR = 20;

type Limiters = {
  user: RateLimiterPostgres;
  ip: RateLimiterPostgres;
  permalink: RateLimiterPostgres;
};

const globalForLimiter = globalThis as unknown as {
  rateLimitPool?: Pool;
  rateLimiters?: { signature: string; limiters: Limiters; userPerHour: number };
  rateLimitCleanupStarted?: boolean;
};

async function limiters(): Promise<{ limiters: Limiters; userPerHour: number }> {
  const { userPerHour, ipPerHour } = await getSettings();
  const signature = `${userPerHour}:${ipPerHour}`;
  const cached = globalForLimiter.rateLimiters;
  if (cached?.signature === signature) return cached;

  const pool = (globalForLimiter.rateLimitPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
  }));
  // งานลบแถวหมดอายุตั้งครั้งเดียวต่อโปรเซส ไม่ต้องสร้างซ้ำทุกครั้งที่เปลี่ยนโควตา
  const clearExpiredByTimeout = !globalForLimiter.rateLimitCleanupStarted;
  globalForLimiter.rateLimitCleanupStarted = true;
  const create = (keyPrefix: string, points: number, cleanup: boolean) =>
    new RateLimiterPostgres({
      storeClient: pool,
      storeType: "pool",
      tableName: "rate_limits",
      tableCreated: true,
      clearExpiredByTimeout: cleanup,
      keyPrefix,
      points,
      duration: HOUR_SECONDS,
    });

  globalForLimiter.rateLimiters = {
    signature,
    userPerHour,
    limiters: {
      user: create("verify_user", userPerHour, clearExpiredByTimeout),
      ip: create("verify_ip", ipPerHour, false),
      permalink: create("permalink_fail", PERMALINK_FAILURES_PER_HOUR, false),
    },
  };
  return globalForLimiter.rateLimiters;
}

const secondsUntil = (res: RateLimiterRes) => Math.max(1, Math.ceil(res.msBeforeNext / 1000));

export type ConsumeResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

// หักโควตาทั้งต่อผู้ใช้และต่อ IP — ถ้า IP เต็มจะคืนแต้มของผู้ใช้ เพื่อไม่ให้ถูกนับซ้ำ
// ถ้าฐานข้อมูลของ rate limit ใช้ไม่ได้จะ throw (fail closed) เพราะเป็นด่านกันการเดาเลขบัตร
export async function consumeVerificationQuota(
  userId: string,
  ipAddress: string | null,
): Promise<ConsumeResult> {
  const { user, ip } = (await limiters()).limiters;

  let userRes: RateLimiterRes;
  try {
    userRes = await user.consume(userId);
  } catch (error) {
    if (error instanceof RateLimiterRes) return { ok: false, retryAfterSec: secondsUntil(error) };
    throw error;
  }

  if (ipAddress) {
    try {
      await ip.consume(ipAddress);
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        await user.reward(userId, 1).catch(() => undefined);
        return { ok: false, retryAfterSec: secondsUntil(error) };
      }
      throw error;
    }
  }

  return { ok: true, remaining: userRes.remainingPoints };
}

export type QuotaStatus = { limit: number; used: number; remaining: number };

export async function getVerificationQuota(userId: string): Promise<QuotaStatus> {
  const { limiters: set, userPerHour } = await limiters();
  const res = await set.user.get(userId);
  const used = Math.min(res?.consumedPoints ?? 0, userPerHour);
  return { limit: userPerHour, used, remaining: userPerHour - used };
}

export async function isPermalinkBlocked(ipAddress: string | null): Promise<boolean> {
  if (!ipAddress) return false;
  const res = await (await limiters()).limiters.permalink.get(ipAddress);
  return !!res && res.consumedPoints >= PERMALINK_FAILURES_PER_HOUR;
}

export async function recordPermalinkFailure(ipAddress: string | null): Promise<void> {
  if (!ipAddress) return;
  await (await limiters()).limiters.permalink.consume(ipAddress).catch(() => undefined);
}
