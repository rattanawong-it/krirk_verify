import { describe, expect, it } from "vitest";
import { generateToken } from "@/lib/crypto";
import { type MatchCandidate, decideVerification } from "@/lib/verification/auto-approve";
import { isLinkExpired, matchesAccessToken } from "@/lib/verification/access-token";
import { buddhistYear, formatRefNo, normalizeRefNo } from "@/lib/verification/ref-no";
import {
  requestListQuerySchema,
  submitOwnRequestSchema,
  submitRequestSchema,
} from "@/lib/validations/verification";

const graduated: MatchCandidate = {
  id: "s1",
  status: "GRADUATED",
  graduationDate: new Date("2022-05-31"),
  councilApprovalDate: new Date("2022-06-28"),
  requiresManualReview: false,
};
const on = { autoApproveEnabled: true };

describe("decideVerification (spec ข้อ 4.2 / 9.1)", () => {
  it("พบ 1 ราย + GRADUATED + วันที่ครบ → AUTO", () => {
    expect(decideVerification([graduated], on)).toEqual({
      outcome: "AUTO_APPROVE",
      studentId: "s1",
    });
  });

  it("พบ 0 ราย → PENDING (NO_MATCH) ไม่บอกผู้ขอว่าไม่พบ", () => {
    expect(decideVerification([], on)).toEqual({
      outcome: "REVIEW",
      reason: "NO_MATCH",
      studentId: null,
    });
  });

  it("พบหลายราย → PENDING (MULTIPLE_MATCHES) แม้ทุกรายจะจบแล้ว", () => {
    expect(decideVerification([graduated, { ...graduated, id: "s2" }], on)).toEqual({
      outcome: "REVIEW",
      reason: "MULTIPLE_MATCHES",
      studentId: null,
    });
  });

  it.each([
    ["REVOKED", "NOT_GRADUATED"],
    ["STUDYING", "NOT_GRADUATED"],
    ["WITHDRAWN", "NOT_GRADUATED"],
  ] as const)("สถานะ %s → PENDING (%s)", (status, reason) => {
    expect(decideVerification([{ ...graduated, status }], on)).toEqual({
      outcome: "REVIEW",
      reason,
      studentId: "s1",
    });
  });

  it("requiresManualReview → PENDING (MANUAL_FLAG) มาก่อนเหตุผลอื่น", () => {
    expect(
      decideVerification([{ ...graduated, status: "REVOKED", requiresManualReview: true }], on),
    ).toMatchObject({ outcome: "REVIEW", reason: "MANUAL_FLAG" });
    expect(decideVerification([{ ...graduated, requiresManualReview: true }], on)).toMatchObject({
      reason: "MANUAL_FLAG",
    });
  });

  it("ไม่มีวันสำเร็จการศึกษาหรือวันสภาอนุมัติ → PENDING (INCOMPLETE_RECORD)", () => {
    expect(decideVerification([{ ...graduated, councilApprovalDate: null }], on)).toMatchObject({
      reason: "INCOMPLETE_RECORD",
    });
    expect(decideVerification([{ ...graduated, graduationDate: null }], on)).toMatchObject({
      reason: "INCOMPLETE_RECORD",
    });
  });

  it("ปิด auto-approve ในตั้งค่าระบบ → PENDING (AUTO_APPROVE_DISABLED)", () => {
    expect(decideVerification([graduated], { autoApproveEnabled: false })).toMatchObject({
      outcome: "REVIEW",
      reason: "AUTO_APPROVE_DISABLED",
      studentId: "s1",
    });
  });
});

describe("เลขอ้างอิง (F-VER-02)", () => {
  it("รูปแบบ KRU-{พ.ศ.}-{6 หลัก} และขยายหลักได้เมื่อเกินล้าน", () => {
    expect(formatRefNo(2569, 123)).toBe("KRU-2569-000123");
    expect(formatRefNo(2569, 1_234_567)).toBe("KRU-2569-1234567");
  });

  it("ปี พ.ศ. ยึดเวลาประเทศไทย (ข้ามปีตอน 17:00 UTC)", () => {
    expect(buddhistYear(new Date("2026-12-31T16:59:59Z"))).toBe(2569);
    expect(buddhistYear(new Date("2026-12-31T17:00:00Z"))).toBe(2570);
  });

  it("normalizeRefNo รับตัวพิมพ์เล็ก/ช่องว่าง และปฏิเสธรูปแบบอื่น", () => {
    expect(normalizeRefNo(" kru-2569-000123 ")).toBe("KRU-2569-000123");
    expect(normalizeRefNo("KRU-2569-12")).toBeNull();
    expect(normalizeRefNo("../../etc")).toBeNull();
  });
});

describe("รหัสเข้าถึง permalink (F-VER-08)", () => {
  const { token, tokenHash } = generateToken();

  it("ยอมรับเฉพาะรหัสที่ตรงกับ hash", () => {
    expect(matchesAccessToken(tokenHash, token)).toBe(true);
    expect(matchesAccessToken(tokenHash, `${token}x`)).toBe(false);
    expect(matchesAccessToken(tokenHash, null)).toBe(false);
    expect(matchesAccessToken(null, token)).toBe(false);
  });

  it("หมดอายุเมื่อถึงเวลา หรือยังไม่เคยออกลิงก์", () => {
    const now = new Date("2026-09-15T00:00:00Z");
    expect(isLinkExpired(new Date("2026-09-16T00:00:00Z"), now)).toBe(false);
    expect(isLinkExpired(now, now)).toBe(true);
    expect(isLinkExpired(null, now)).toBe(true);
  });
});

describe("submitRequestSchema (F-VER-03/04)", () => {
  const base = { purpose: "EMPLOYMENT", consent: true } as const;

  it("เลขบัตรต้องผ่าน checksum และตัดขีดออก", () => {
    const ok = submitRequestSchema.safeParse({
      ...base,
      searchType: "CITIZEN_ID",
      searchValue: "1-1017-00230-70-8",
    });
    expect(ok.success && ok.data.searchValue).toBe("1101700230708");

    const bad = submitRequestSchema.safeParse({
      ...base,
      searchType: "CITIZEN_ID",
      searchValue: "1101700230709",
    });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]).toMatchObject({
      path: ["searchValue"],
      message: "validation.citizenId",
    });
  });

  it("พาสปอร์ตแปลงเป็นตัวพิมพ์ใหญ่ และตรวจรูปแบบ", () => {
    const ok = submitRequestSchema.safeParse({
      ...base,
      searchType: "PASSPORT",
      searchValue: "e12345678",
    });
    expect(ok.success && ok.data.searchValue).toBe("E12345678");
    expect(
      submitRequestSchema.safeParse({ ...base, searchType: "PASSPORT", searchValue: "AB-1" }).error
        ?.issues[0]?.message,
    ).toBe("validation.passport");
  });

  it("บังคับติ๊ก PDPA consent", () => {
    const result = submitOwnRequestSchema.safeParse({ ...base, consent: false });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["consent"],
      message: "validation.consent",
    });
  });

  it("query รายการคำขอที่ผิดรูปแบบไม่ทำให้หน้าล้ม", () => {
    expect(requestListQuerySchema.parse({ status: "HACK", page: "-4" })).toEqual({
      status: undefined,
      q: undefined,
      page: 1,
    });
  });
});
