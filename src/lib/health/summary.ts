// F-OPS-03 — สรุปผล health check (pure function เพื่อ unit test ได้)
// ฐานข้อมูลล่ม = ระบบใช้งานไม่ได้ (503) · ระบบทะเบียนล่ม = ยังค้นหาจากข้อมูลที่ sync ไว้ได้ จึงเป็นแค่ degraded (200)

export type ComponentHealth =
  { status: "up"; latencyMs: number } | { status: "down"; code: string } | { status: "skipped" };

export type HealthStatus = "ok" | "degraded" | "down";

export type HealthReport = {
  status: HealthStatus;
  checks: { database: ComponentHealth; registry: ComponentHealth };
  uptimeSeconds: number;
  timestamp: string;
};

export function summarizeHealth(
  checks: HealthReport["checks"],
  now: Date,
  uptimeSeconds: number,
): { report: HealthReport; httpStatus: 200 | 503 } {
  const status: HealthStatus =
    checks.database.status !== "up"
      ? "down"
      : checks.registry.status === "down"
        ? "degraded"
        : "ok";
  return {
    report: {
      status,
      checks,
      uptimeSeconds: Math.floor(uptimeSeconds),
      timestamp: now.toISOString(),
    },
    httpStatus: status === "down" ? 503 : 200,
  };
}
