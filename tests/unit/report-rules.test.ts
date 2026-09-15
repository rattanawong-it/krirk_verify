import { describe, expect, it } from "vitest";
import {
  MAX_REPORT_DAYS,
  bangkokDayKey,
  dashboardPeriod,
  fillSeries,
  hoursBetween,
  percentChange,
  previousMonth,
  reportPeriod,
  share,
  shiftMonth,
} from "@/lib/reports/range";

// 15 ก.ย. 2569 10:00 น. เวลาไทย
const NOW = new Date("2026-09-15T03:00:00Z");

describe("ช่วงเวลาแดชบอร์ด (F-RPT-02/03)", () => {
  it("7 วัน: รวมวันนี้ เริ่มเที่ยงคืนเวลาไทย และช่วงก่อนหน้ายาวเท่ากัน", () => {
    const period = dashboardPeriod("7d", NOW);
    expect(period.granularity).toBe("day");
    expect(period.buckets).toHaveLength(7);
    expect(period.buckets[0]).toBe("2026-09-09");
    expect(period.buckets.at(-1)).toBe("2026-09-15");
    expect(period.from.toISOString()).toBe("2026-09-08T17:00:00.000Z");
    expect(period.previousFrom.toISOString()).toBe("2026-09-01T17:00:00.000Z");
  });

  it("ใช้วันที่ตามเวลาไทย แม้ UTC ยังเป็นวันก่อน", () => {
    const earlyMorning = new Date("2026-09-14T18:30:00Z"); // 01:30 น. วันที่ 15
    expect(bangkokDayKey(earlyMorning)).toBe("2026-09-15");
    expect(dashboardPeriod("30d", earlyMorning).buckets.at(-1)).toBe("2026-09-15");
  });

  it("1 ปี: 12 เดือนรวมเดือนปัจจุบัน ข้ามปีได้", () => {
    const period = dashboardPeriod("1y", NOW);
    expect(period.granularity).toBe("month");
    expect(period.buckets).toHaveLength(12);
    expect(period.buckets[0]).toBe("2025-10");
    expect(period.buckets.at(-1)).toBe("2026-09");
    expect(period.from.toISOString()).toBe("2025-09-30T17:00:00.000Z");
    expect(dashboardPeriod("1y", new Date("2026-01-10T03:00:00Z")).buckets[0]).toBe("2025-02");
  });

  it("เลื่อนเดือนข้ามปีทั้งไปข้างหน้าและย้อนหลัง", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-09", -21)).toBe("2024-12");
  });
});

describe("ช่วงวันที่ของรายงาน (F-RPT-06)", () => {
  it("ค่าเริ่มต้นคือ 30 วันล่าสุดรวมวันนี้", () => {
    const period = reportPeriod(undefined, undefined, NOW);
    expect(period.fromKey).toBe("2026-08-17");
    expect(period.toKey).toBe("2026-09-15");
    expect(period.to.toISOString()).toBe("2026-09-15T17:00:00.000Z");
  });

  it("สลับวันที่ที่กรอกกลับด้าน", () => {
    const period = reportPeriod("2026-09-10", "2026-09-01", NOW);
    expect(period.fromKey).toBe("2026-09-01");
    expect(period.toKey).toBe("2026-09-10");
  });

  it(`จำกัดช่วงไม่เกิน ${MAX_REPORT_DAYS} วัน`, () => {
    const period = reportPeriod("2020-01-01", "2026-09-15", NOW);
    expect((period.to.getTime() - period.from.getTime()) / 86_400_000).toBe(MAX_REPORT_DAYS);
  });

  it("เดือนก่อนหน้าแบบเต็มเดือนตามเวลาไทย (F-RPT-08)", () => {
    const month = previousMonth(new Date("2026-01-01T02:00:00Z")); // 09:00 น. 1 ม.ค.
    expect(month.key).toBe("2025-12");
    expect(month.from.toISOString()).toBe("2025-11-30T17:00:00.000Z");
    expect(month.to.toISOString()).toBe("2025-12-31T17:00:00.000Z");
  });
});

describe("การคำนวณตัวชี้วัด", () => {
  it("% เปลี่ยนแปลง — ช่วงก่อนหน้าเป็น 0 ไม่แสดง", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(5, 0)).toBeNull();
  });

  it("เวลาพิจารณาเป็นชั่วโมง ทศนิยม 1 ตำแหน่ง", () => {
    const created = new Date("2026-09-15T01:00:00Z");
    expect(hoursBetween(created, new Date("2026-09-15T04:15:00Z"))).toBe(3.3);
    expect(hoursBetween(created, null)).toBeNull();
  });

  it("สัดส่วนปัดเป็นจำนวนเต็ม และไม่หารด้วย 0", () => {
    expect(share(2, 3)).toBe(67);
    expect(share(0, 0)).toBe(0);
  });

  it("เติมวันที่ไม่มีข้อมูลเป็น 0 และข้ามข้อมูลนอกช่วง", () => {
    const series = fillSeries(
      ["2026-09-14", "2026-09-15"],
      [
        { bucket: "2026-09-15", approved: 3, pending: 1 },
        { bucket: "2026-01-01", approved: 9, pending: 9 },
      ],
      ["approved", "pending"] as const,
    );
    expect(series).toEqual([
      { bucket: "2026-09-14", approved: 0, pending: 0 },
      { bucket: "2026-09-15", approved: 3, pending: 1 },
    ]);
  });
});
