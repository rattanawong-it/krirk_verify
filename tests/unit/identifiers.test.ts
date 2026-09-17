import { describe, expect, it } from "vitest";
import {
  formatCitizenId,
  isValidPassportNo,
  isValidStudentCode,
  isValidThaiCitizenId,
} from "@/lib/validations/identifiers";

describe("isValidThaiCitizenId", () => {
  it("ยอมรับเลขที่ checksum ถูกต้อง ทั้งแบบมีและไม่มีขีด", () => {
    expect(isValidThaiCitizenId("1101700230708")).toBe(true);
    expect(isValidThaiCitizenId("1-1017-00230-70-8")).toBe(true);
  });

  it("ปฏิเสธเลขที่ checksum ผิด", () => {
    expect(isValidThaiCitizenId("1101700230703")).toBe(false);
  });

  it("ปฏิเสธความยาวไม่ครบหรือมีตัวอักษร", () => {
    expect(isValidThaiCitizenId("110170023070")).toBe(false);
    expect(isValidThaiCitizenId("11017002307031")).toBe(false);
    expect(isValidThaiCitizenId("11017002307A3")).toBe(false);
    expect(isValidThaiCitizenId("")).toBe(false);
  });
});

describe("isValidPassportNo", () => {
  it("ยอมรับ 6–9 ตัวอักษร/ตัวเลข", () => {
    expect(isValidPassportNo("AA123456")).toBe(true);
    expect(isValidPassportNo("ab1234567")).toBe(true);
  });

  it("ปฏิเสธสั้น/ยาวเกิน หรือมีอักขระพิเศษ", () => {
    expect(isValidPassportNo("AB12")).toBe(false);
    expect(isValidPassportNo("AB12345678")).toBe(false);
    expect(isValidPassportNo("AB#12345")).toBe(false);
  });
});

describe("formatCitizenId / isValidStudentCode", () => {
  it("จัดรูปแบบเลขบัตรระหว่างพิมพ์", () => {
    expect(formatCitizenId("1101700230703")).toBe("1-1017-00230-70-3");
    expect(formatCitizenId("11017")).toBe("1-1017");
  });

  it("รหัสนักศึกษาที่ผู้ใช้กรอกเป็นตัวเลข 8–12 หลัก (รูปแบบ Keystone)", () => {
    expect(isValidStudentCode("6012345678")).toBe(true);
    expect(isValidStudentCode("64010001")).toBe(true);
    expect(isValidStudentCode("641110103001")).toBe(true);
    expect(isValidStudentCode("6401000")).toBe(false);
    expect(isValidStudentCode("6411101030011")).toBe(false);
  });
});
