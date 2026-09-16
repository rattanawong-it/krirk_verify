import { describe, expect, it } from "vitest";
import { summarizeHealth } from "@/lib/health/summary";

const NOW = new Date("2026-09-16T03:00:00Z");
const up = { status: "up", latencyMs: 4 } as const;

describe("สรุปผล health check (F-OPS-03)", () => {
  it("ทุกส่วนปกติ → ok / 200", () => {
    const { report, httpStatus } = summarizeHealth({ database: up, registry: up }, NOW, 12.7);
    expect(report.status).toBe("ok");
    expect(httpStatus).toBe(200);
    expect(report.uptimeSeconds).toBe(12);
    expect(report.timestamp).toBe("2026-09-16T03:00:00.000Z");
  });

  it("ระบบทะเบียนล่ม → degraded แต่ยังตอบ 200 (ค้นหาจากข้อมูลที่ sync ไว้ได้)", () => {
    const { report, httpStatus } = summarizeHealth(
      { database: up, registry: { status: "down", code: "TIMEOUT" } },
      NOW,
      1,
    );
    expect(report.status).toBe("degraded");
    expect(httpStatus).toBe(200);
  });

  it("ฐานข้อมูลล่ม → down / 503 ไม่ว่าระบบทะเบียนจะเป็นอย่างไร", () => {
    const down = { status: "down", code: "UNREACHABLE" } as const;
    expect(summarizeHealth({ database: down, registry: up }, NOW, 1).httpStatus).toBe(503);
    expect(summarizeHealth({ database: down, registry: down }, NOW, 1).report.status).toBe("down");
  });

  it("ข้ามการตรวจระบบทะเบียน → ถือว่า ok ถ้าฐานข้อมูลปกติ", () => {
    const { report } = summarizeHealth({ database: up, registry: { status: "skipped" } }, NOW, 1);
    expect(report.status).toBe("ok");
  });
});
