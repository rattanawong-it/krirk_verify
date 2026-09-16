import { describe, expect, it } from "vitest";
import { queueDigestTemplate } from "@/lib/email/digest-templates";
import { EMAIL_TEMPLATE_NAMES, isEmailTemplateName, renderEmail } from "@/lib/email/registry";
import { notificationValues } from "@/lib/notifications/display";

// Phase 9 — F-NOT-01/03/04/05

const approvedPayload = {
  locale: "th",
  refNo: "KRU-2569-000123",
  fullName: "นางสาวทดสอบ ระบบ",
  degree: "บริหารธุรกิจบัณฑิต",
  graduationDate: "2026-03-15T00:00:00.000Z",
  decision: "AUTO",
  url: "http://localhost:3000/verify/result/KRU-2569-000123?t=abc",
  expiresDays: 90,
};

describe("ทะเบียนเทมเพลตอีเมล (F-NOT-01)", () => {
  it("render จาก payload ที่อ่านกลับมาจาก JSON ได้ (วันที่เป็น string)", () => {
    const mail = renderEmail("resultApproved", approvedPayload);
    expect(mail).not.toBeNull();
    expect(mail?.subject).toContain("KRU-2569-000123");
    expect(mail?.html).toContain("KRU-2569-000123");
    // วันสำเร็จการศึกษาแสดงเป็น พ.ศ. ในภาษาไทย
    expect(mail?.html).toContain("2569");
  });

  it("payload ที่เป็น Date object ก็ใช้ได้ (ตอนส่งครั้งแรก)", () => {
    const mail = renderEmail("resultApproved", {
      ...approvedPayload,
      graduationDate: new Date("2026-03-15T00:00:00.000Z"),
    });
    expect(mail?.subject).toContain("KRU-2569-000123");
  });

  it("payload ที่ผิดรูปแบบคืน null แทนที่จะโยน error (retry จะไม่วนซ้ำ)", () => {
    expect(renderEmail("resultApproved", { locale: "th" })).toBeNull();
    expect(renderEmail("resultApproved", null)).toBeNull();
    expect(
      renderEmail("resultRejected", { ...approvedPayload, reason: "ไม่มีรหัสนี้" }),
    ).toBeNull();
  });

  it("รู้จักเฉพาะชื่อเทมเพลตที่มีจริง", () => {
    expect(isEmailTemplateName("queueDigest")).toBe(true);
    expect(isEmailTemplateName("constructor")).toBe(false);
    expect(isEmailTemplateName("ไม่มีจริง")).toBe(false);
    expect(EMAIL_TEMPLATE_NAMES).toContain("verifyEmail");
  });
});

describe("อีเมลสรุปคิวรายวัน (F-NOT-03)", () => {
  const summary = {
    name: "เจ้าหน้าที่ทะเบียน",
    generatedAt: new Date("2026-09-16T01:30:00Z"),
    newToday: 4,
    pending: 12,
    overSla: 3,
    oldestWaitHours: 26.5,
    url: "http://localhost:3000/staff/queue",
  };

  it("ภาษาไทยมีจำนวนคำขอในหัวเรื่องและตัวเลขครบในเนื้อหา", () => {
    const mail = queueDigestTemplate({ locale: "th", ...summary });
    expect(mail.subject).toContain("12");
    expect(mail.html).toContain("26.5");
    expect(mail.text).toContain(summary.url);
  });

  it("ภาษาอังกฤษใช้ข้อความของตนเอง และคิวที่ไม่มีรายการเก่าสุดแสดงขีด", () => {
    const mail = queueDigestTemplate({ locale: "en", ...summary, oldestWaitHours: null });
    expect(mail.subject).toContain("awaiting review");
    expect(mail.html).toContain("—");
  });

  it("ไม่มีข้อมูลส่วนบุคคลของผู้ถูกตรวจสอบ (ไม่มีเลข 13 หลัก)", () => {
    const mail = queueDigestTemplate({ locale: "th", ...summary });
    expect(mail.html).not.toMatch(/\d{13}/);
  });
});

describe("ค่าประกอบข้อความแจ้งเตือน (F-NOT-05)", () => {
  it("เติมค่าที่ขาดเป็นค่าว่าง ไม่ให้ข้อความแปลพัง", () => {
    expect(notificationValues(null)).toEqual({ refNo: "", orgName: "", errorCode: "", count: 0 });
  });

  it("รับเฉพาะค่าที่ชนิดถูกต้องจาก JSON", () => {
    expect(notificationValues({ refNo: "KRU-2569-000001", count: 3 })).toMatchObject({
      refNo: "KRU-2569-000001",
      count: 3,
    });
    expect(notificationValues({ refNo: 12345, count: "3" })).toMatchObject({
      refNo: "",
      count: 0,
    });
  });
});
