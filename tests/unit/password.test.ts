import { describe, expect, it } from "vitest";
import { checkPasswordPolicy } from "@/lib/validations/password";

describe("checkPasswordPolicy", () => {
  it("ผ่านเมื่อยาวพอและมีทั้งตัวอักษรและตัวเลข", () => {
    expect(checkPasswordPolicy("krirk2569")).toEqual([]);
  });

  it("แจ้งทุกข้อที่ไม่ผ่าน", () => {
    expect(checkPasswordPolicy("abc")).toEqual(["tooShort", "needNumber"]);
    expect(checkPasswordPolicy("12345678")).toEqual(["needLetter"]);
  });

  it("ห้ามใช้อีเมลเป็นรหัสผ่าน", () => {
    expect(checkPasswordPolicy("HR1@corp.co", "hr1@corp.co")).toContain("sameAsEmail");
  });

  it("ปฏิเสธรหัสผ่านที่เกิน 72 bytes (ข้อจำกัดของ bcrypt)", () => {
    expect(checkPasswordPolicy("ก".repeat(25) + "a1")).toContain("tooLong");
  });
});
