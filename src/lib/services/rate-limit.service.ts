import "server-only";
import { Pool } from "pg";
import { RateLimiterPostgres, RateLimiterRes } from "rate-limiter-flexible";

// F-VER-10 — rate limit เก็บใน PostgreSQL (ตาราง rate_limits สร้างผ่าน Prisma migration จึงตั้ง tableCreated)
// ใช้ connection pool แยกขนาดเล็ก เพราะไลบรารีต้องการ pg.Pool ไม่ใช่ Prisma client

const HOUR_SECONDS = 60 * 60;
// ครั้งที่เปิด permalink ด้วยรหัสผิดต่อ IP ต่อชั่วโมง
const PERMALINK_FAILURES_PER_HOUR = 20;

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

type Limiters = {
  user: RateLimiterPostgres;
  ip: RateLimiterPostgres;
  permalink: RateLimiterPostgres;
};

const globalForLimiter = globalThis as unknown as { rateLimitPool?: Pool; rateLimiters?: Limiters };

function limiters(): Limiters {
  if (globalForLimiter.rateLimiters) return globalForLimiter.rateLimiters;

  const pool = (globalForLimiter.rateLimitPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
  }));
  const create = (keyPrefix: string, points: number) =>
    new RateLimiterPostgres({
      storeClient: pool,
      storeType: "pool",
      tableName: "rate_limits",
      tableCreated: true,
      clearExpiredByTimeout: true,
      keyPrefix,
      points,
      duration: HOUR_SECONDS,
    });

  globalForLimiter.rateLimiters = {
    user: create("verify_user", userLimit()),
    ip: create("verify_ip", positiveInt(process.env.RATE_LIMIT_IP_PER_HOUR, 60)),
    permalink: create("permalink_fail", PERMALINK_FAILURES_PER_HOUR),
  };
  return globalForLimiter.rateLimiters;
}

function userLimit(): number {
  return positiveInt(process.env.RATE_LIMIT_USER_PER_HOUR, 30);
}

const secondsUntil = (res: RateLimiterRes) => Math.max(1, Math.ceil(res.msBeforeNext / 1000));

export type ConsumeResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

// หักโควตาทั้งต่อผู้ใช้และต่อ IP — ถ้า IP เต็มจะคืนแต้มของผู้ใช้ เพื่อไม่ให้ถูกนับซ้ำ
// ถ้าฐานข้อมูลของ rate limit ใช้ไม่ได้จะ throw (fail closed) เพราะเป็นด่านกันการเดาเลขบัตร
export async function consumeVerificationQuota(
  userId: string,
  ipAddress: string | null,
): Promise<ConsumeResult> {
  const { user, ip } = limiters();

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
  const limit = userLimit();
  const res = await limiters().user.get(userId);
  const used = Math.min(res?.consumedPoints ?? 0, limit);
  return { limit, used, remaining: limit - used };
}

export async function isPermalinkBlocked(ipAddress: string | null): Promise<boolean> {
  if (!ipAddress) return false;
  const res = await limiters().permalink.get(ipAddress);
  return !!res && res.consumedPoints >= PERMALINK_FAILURES_PER_HOUR;
}

export async function recordPermalinkFailure(ipAddress: string | null): Promise<void> {
  if (!ipAddress) return;
  await limiters()
    .permalink.consume(ipAddress)
    .catch(() => undefined);
}
