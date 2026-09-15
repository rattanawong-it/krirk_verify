// Phase 6 — ช่วงเวลาของแดชบอร์ดและรายงาน คำนวณตามเวลาไทย (UTC+7 ไม่มี daylight saving)
// แยกเป็นฟังก์ชันล้วนเพื่อทดสอบได้โดยไม่ต้องใช้ฐานข้อมูล

export const DASHBOARD_RANGES = ["7d", "30d", "1y"] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
export type Granularity = "day" | "month";

const DAY_MS = 86_400_000;
// จำกัดช่วงของหน้ารายงาน — กันการ query/export ข้อมูลทั้งระบบในครั้งเดียว
export const MAX_REPORT_DAYS = 366;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function bangkokDayKey(date: Date): string {
  return dayFormatter.format(date);
}

export function bangkokMonthKey(date: Date): string {
  return bangkokDayKey(date).slice(0, 7);
}

export function dayStart(key: string): Date {
  return new Date(`${key}T00:00:00+07:00`);
}

function monthStart(key: string): Date {
  return new Date(`${key}-01T00:00:00+07:00`);
}

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number) as [number, number];
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export type Period = {
  from: Date;
  to: Date;
  // ช่วงก่อนหน้าที่ยาวเท่ากัน สิ้นสุดที่ from — ใช้คำนวณ % เปลี่ยนแปลงของตัวชี้วัด
  previousFrom: Date;
  granularity: Granularity;
  buckets: string[];
};

export function dashboardPeriod(range: DashboardRange, now: Date): Period {
  if (range === "1y") {
    const current = bangkokMonthKey(now);
    const buckets = Array.from({ length: 12 }, (_, i) => shiftMonth(current, i - 11));
    const first = buckets[0]!;
    return {
      from: monthStart(first),
      to: now,
      previousFrom: monthStart(shiftMonth(first, -12)),
      granularity: "month",
      buckets,
    };
  }
  const days = range === "7d" ? 7 : 30;
  const today = dayStart(bangkokDayKey(now));
  const from = new Date(today.getTime() - (days - 1) * DAY_MS);
  return {
    from,
    to: now,
    previousFrom: new Date(from.getTime() - days * DAY_MS),
    granularity: "day",
    buckets: Array.from({ length: days }, (_, i) =>
      bangkokDayKey(new Date(from.getTime() + i * DAY_MS)),
    ),
  };
}

// ช่วงวันที่ของหน้ารายงาน (รวมวันสุดท้าย) · ค่าเริ่มต้น 30 วันล่าสุด · สลับให้ถ้ากรอกกลับด้าน
export function reportPeriod(fromKey: string | undefined, toKey: string | undefined, now: Date) {
  let toK = toKey ?? bangkokDayKey(now);
  let fromK = fromKey ?? bangkokDayKey(new Date(dayStart(toK).getTime() - 29 * DAY_MS));
  if (fromK > toK) [fromK, toK] = [toK, fromK];

  const to = new Date(dayStart(toK).getTime() + DAY_MS);
  let from = dayStart(fromK);
  if (to.getTime() - from.getTime() > MAX_REPORT_DAYS * DAY_MS) {
    from = new Date(to.getTime() - MAX_REPORT_DAYS * DAY_MS);
  }
  return { from, to, fromKey: bangkokDayKey(from), toKey: toK };
}

// ช่วงเดือนก่อนหน้าแบบเต็มเดือน — ใช้กับรายงานสรุปประจำเดือน (F-RPT-08)
export function previousMonth(now: Date) {
  const key = shiftMonth(bangkokMonthKey(now), -1);
  return { key, from: monthStart(key), to: monthStart(shiftMonth(key, 1)) };
}

// ระยะเวลาเป็นชั่วโมง ทศนิยม 1 ตำแหน่ง (เวลาพิจารณาในรายงาน) · ยังไม่ตัดสิน = null
export function hoursBetween(start: Date, end: Date | null): number | null {
  if (!end) return null;
  return Math.round((end.getTime() - start.getTime()) / 360_000) / 10;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function share(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// เติมช่วงที่ไม่มีข้อมูลเป็น 0 ให้กราฟต่อเนื่อง · ข้ามแถวที่อยู่นอกช่วง
export function fillSeries<K extends string>(
  buckets: readonly string[],
  rows: readonly ({ bucket: string } & Record<K, number>)[],
  keys: readonly K[],
): ({ bucket: string } & Record<K, number>)[] {
  const byBucket = new Map(rows.map((row) => [row.bucket, row]));
  return buckets.map((bucket) => {
    const row = byBucket.get(bucket);
    const values = Object.fromEntries(keys.map((key) => [key, row ? row[key] : 0])) as Record<
      K,
      number
    >;
    return { bucket, ...values };
  });
}
