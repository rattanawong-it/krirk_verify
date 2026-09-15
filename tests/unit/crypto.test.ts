import { describe, expect, it } from "vitest";
import {
  decrypt,
  encrypt,
  generateToken,
  hashIdentifier,
  hashToken,
  maskCitizenId,
  maskPassportNo,
} from "@/lib/crypto";

describe("hashIdentifier", () => {
  it("ให้ค่าเดิมทุกครั้ง และไม่สนขีด/ช่องว่าง/ตัวพิมพ์", () => {
    const a = hashIdentifier("1-2345-67890-12-1");
    expect(hashIdentifier("1234567890121")).toBe(a);
    expect(hashIdentifier(" 1 2345 67890 12 1 ")).toBe(a);
    expect(hashIdentifier("ab1234567")).toBe(hashIdentifier("AB1234567"));
  });

  it("ไม่ใช่ SHA-256 ธรรมดา (มี pepper) และค่าต่างกันให้ hash ต่างกัน", () => {
    expect(hashIdentifier("1234567890121")).not.toBe(hashToken("1234567890121"));
    expect(hashIdentifier("1234567890121")).not.toBe(hashIdentifier("1234567890122"));
  });
});

describe("encrypt / decrypt", () => {
  it("ถอดรหัสได้ค่าเดิม", () => {
    expect(decrypt(encrypt("1234567890121"))).toBe("1234567890121");
  });

  it("เข้ารหัสค่าเดิมสองครั้งได้ ciphertext ต่างกัน (IV สุ่ม)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("ปฏิเสธข้อมูลที่ถูกแก้ไข", () => {
    const parts = encrypt("1234567890121").split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
});

describe("mask", () => {
  it("maskCitizenId ไม่หลุดเลขกลาง", () => {
    const masked = maskCitizenId("1234567890123");
    expect(masked).toBe("1-2345-xxxxx-xx-3");
    expect(masked).not.toContain("67890");
  });

  it("maskCitizenId กับค่าผิดรูปแบบไม่แสดงตัวเลขเลย", () => {
    expect(maskCitizenId("12345")).toBe("x-xxxx-xxxxx-xx-x");
  });

  it("maskPassportNo แสดงเฉพาะ 2 ตัวหน้าและ 2 ตัวท้าย", () => {
    expect(maskPassportNo("ab1234567")).toBe("ABxxxxx67");
  });
});

describe("generateToken", () => {
  it("tokenHash ตรงกับ hashToken(token) และ token ไม่ซ้ำกัน", () => {
    const a = generateToken();
    const b = generateToken();
    expect(hashToken(a.token)).toBe(a.tokenHash);
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
  });
});
