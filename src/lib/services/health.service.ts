import "server-only";
import { prisma } from "@/lib/db/prisma";
import { type ComponentHealth, summarizeHealth } from "@/lib/health/summary";
import { checkRegistryHealth } from "./sync.service";

// F-OPS-03 — ตรวจฐานข้อมูลและระบบทะเบียนพร้อมกัน · จำกัดเวลาเพื่อไม่ให้ health check ค้าง

const DB_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function checkDatabase(): Promise<ComponentHealth> {
  const started = performance.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    return { status: "up", latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    // ไม่ส่งข้อความ error ของฐานข้อมูลออกไป (อาจมี host/ชื่อผู้ใช้) — บันทึกไว้ใน log ของ container แทน
    console.error("[health] database check failed", error);
    const code = error instanceof Error && error.message === "timeout" ? "TIMEOUT" : "UNREACHABLE";
    return { status: "down", code };
  }
}

async function checkRegistry(): Promise<ComponentHealth> {
  const result = await checkRegistryHealth();
  return result.ok
    ? { status: "up", latencyMs: result.latencyMs }
    : { status: "down", code: result.code };
}

export async function getHealth({ includeRegistry = true } = {}) {
  const [database, registry] = await Promise.all([
    checkDatabase(),
    includeRegistry ? checkRegistry() : Promise.resolve<ComponentHealth>({ status: "skipped" }),
  ]);
  return summarizeHealth({ database, registry }, new Date(), process.uptime());
}
