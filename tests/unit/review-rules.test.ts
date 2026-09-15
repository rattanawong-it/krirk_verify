import { describe, expect, it } from "vitest";
import {
  organizationActionSchema,
  queueQuerySchema,
  rejectRequestSchema,
} from "@/lib/validations/review";
import {
  REJECT_REASONS,
  isRejectReason,
  statusForRejectReason,
} from "@/lib/verification/reject-reasons";
import { formatWait, slaCutoff, slaLevel, waitParts } from "@/lib/verification/sla";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-09-15T12:00:00Z");
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);

describe("SLA (F-REG-09)", () => {
  it("ok ก่อน 75% · warn ตั้งแต่ 75% · over เมื่อครบ SLA", () => {
    expect(slaLevel(ago(17.9), now, 24)).toBe("ok");
    expect(slaLevel(ago(18), now, 24)).toBe("warn");
    expect(slaLevel(ago(23.99), now, 24)).toBe("warn");
    expect(slaLevel(ago(24), now, 24)).toBe("over");
  });

  it("slaCutoff สอดคล้องกับ slaLevel", () => {
    const cutoff = slaCutoff(now, 24);
    expect(slaLevel(cutoff, now, 24)).toBe("over");
    expect(slaLevel(new Date(cutoff.getTime() + 1), now, 24)).not.toBe("over");
  });

  it("รูปแบบเวลารอตามดีไซน์", () => {
    expect(formatWait(26 * HOUR + 40 * 60_000)).toBe("26h 40m");
    expect(formatWait(4 * HOUR + 5 * 60_000)).toBe("4h 05m");
    expect(formatWait(48 * 60_000)).toBe("48m");
    expect(formatWait(-1000)).toBe("0m");
    expect(waitParts(4 * HOUR + 12 * 60_000)).toEqual({ hours: 4, minutes: 12 });
  });
});

describe("เหตุผลการปฏิเสธ (F-REG-05)", () => {
  it("ไม่พบข้อมูลที่ตรงกัน → NOT_FOUND · เหตุผลอื่น → REJECTED", () => {
    expect(statusForRejectReason("NO_MATCHING_RECORD")).toBe("NOT_FOUND");
    for (const reason of REJECT_REASONS.filter((r) => r !== "NO_MATCHING_RECORD")) {
      expect(statusForRejectReason(reason)).toBe("REJECTED");
    }
    expect(isRejectReason("HACK")).toBe(false);
  });

  it("เลือก 'อื่น ๆ' ต้องกรอกรายละเอียด", () => {
    const base = { refNo: "KRU-2569-000001" };
    expect(
      rejectRequestSchema.safeParse({ ...base, reason: "OTHER" }).error?.issues[0],
    ).toMatchObject({
      path: ["detail"],
      message: "validation.required",
    });
    expect(
      rejectRequestSchema.safeParse({ ...base, reason: "OTHER", detail: "เอกสารไม่ชัด" }).success,
    ).toBe(true);
    expect(rejectRequestSchema.safeParse({ ...base, reason: "NO_MATCHING_RECORD" }).success).toBe(
      true,
    );
  });
});

describe("schema หน่วยงาน/คิว", () => {
  it("ระงับหรือปฏิเสธหน่วยงานต้องมีเหตุผล แต่อนุมัติ/คืนสิทธิ์ไม่ต้อง", () => {
    const base = { organizationId: "org1" };
    expect(organizationActionSchema.safeParse({ ...base, action: "suspend" }).success).toBe(false);
    expect(organizationActionSchema.safeParse({ ...base, action: "reject" }).success).toBe(false);
    expect(organizationActionSchema.safeParse({ ...base, action: "approve" }).success).toBe(true);
    expect(organizationActionSchema.safeParse({ ...base, action: "restore" }).success).toBe(true);
  });

  it("query คิวที่ผิดรูปแบบใช้ค่าเริ่มต้นแทน", () => {
    expect(
      queueQuerySchema.parse({
        reason: "X",
        sla: "under",
        from: "13/09/2569",
        sort: "?",
        page: "0",
      }),
    ).toEqual({
      reason: undefined,
      sla: undefined,
      org: undefined,
      from: undefined,
      to: undefined,
      sort: "oldest",
      page: 1,
    });
  });
});
