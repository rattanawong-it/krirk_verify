import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/utils/duration";

describe("formatDuration", () => {
  it("แสดงตามรูปแบบในดีไซน์หน้า sync", () => {
    expect(formatDuration(800)).toBe("0.8s");
    expect(formatDuration(48_000)).toBe("48s");
    expect(formatDuration(90_000)).toBe("1m 30s");
    expect(formatDuration(242_000)).toBe("4m 02s");
    expect(formatDuration(3_900_000)).toBe("1h 05m");
  });

  it("ค่าติดลบ (นาฬิกาเหลื่อม) ไม่แสดงเลขติดลบ", () => {
    expect(formatDuration(-5)).toBe("0.0s");
  });
});
