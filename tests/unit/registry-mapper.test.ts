import { describe, expect, it } from "vitest";
import { decrypt, hashIdentifier } from "@/lib/crypto";
import { isValidCronSecret } from "@/lib/auth/cron-secret";
import { hasSourceChanged, toStudentRow } from "@/lib/integrations/registry/mapper";
import { MOCK_TEST_CASES, generateMockStudents } from "@/lib/integrations/registry/mock-data";

const students = generateMockStudents(new Date("2026-09-15T00:00:00.000Z"));
const byCode = (code: string) => students.find((s) => s.studentCode === code)!;

describe("toStudentRow", () => {
  it("เก็บเลขบัตรเป็น HMAC + ciphertext ไม่มีเลขเต็มในแถว", () => {
    const dto = byCode("6012345678");
    const row = toStudentRow(dto);

    expect(row.citizenIdHash).toBe(hashIdentifier(dto.citizenId!));
    expect(decrypt(row.citizenIdEnc!)).toBe(dto.citizenId);
    expect(JSON.stringify(row)).not.toContain(dto.citizenId);
    expect(row.passportNoHash).toBeNull();
  });

  it("ชาวต่างชาติมีเฉพาะ hash พาสปอร์ต", () => {
    const foreign = MOCK_TEST_CASES.find((c) => c.searchType === "PASSPORT")!;
    const row = toStudentRow(byCode(foreign.studentCode));
    expect(row.citizenIdHash).toBeNull();
    expect(row.passportNoHash).toBe(hashIdentifier(foreign.identifier));
  });

  it("แปลงวันที่ / GPA / เวลาอัปเดตต้นทาง", () => {
    const syncedAt = new Date("2026-09-15T02:00:00.000Z");
    const row = toStudentRow(byCode("6012345678"), syncedAt);
    expect(row.graduationDate).toEqual(new Date("2022-05-31T00:00:00.000Z"));
    expect(row.gpa).toBe("3.87");
    expect(row.sourceUpdatedAt).toEqual(new Date("2026-06-01T02:00:00.000Z"));
    expect(row.syncedAt).toBe(syncedAt);
    expect(toStudentRow(byCode("4012345678")).councilApprovalDate).toBeNull();
  });
});

describe("hasSourceChanged", () => {
  const stored = new Date("2026-06-01T02:00:00.000Z");

  it("ระเบียนใหม่หรือเวลาต้นทางใหม่กว่า = เปลี่ยน", () => {
    expect(hasSourceChanged(null, "2026-06-01T02:00:00.000Z")).toBe(true);
    expect(hasSourceChanged(stored, "2026-06-01T02:00:01.000Z")).toBe(true);
  });

  it("เวลาเท่าเดิมหรือเก่ากว่า = ไม่เปลี่ยน", () => {
    expect(hasSourceChanged(stored, "2026-06-01T02:00:00.000Z")).toBe(false);
    expect(hasSourceChanged(stored, "2026-05-01T00:00:00.000Z")).toBe(false);
  });
});

describe("isValidCronSecret", () => {
  const secret = "test-cron-secret-not-real-0123456789";

  it("ยอมรับเฉพาะ secret ที่ตรงกัน", () => {
    expect(isValidCronSecret(secret, secret)).toBe(true);
    expect(isValidCronSecret(`${secret}x`, secret)).toBe(false);
    expect(isValidCronSecret(null, secret)).toBe(false);
  });

  it("ปฏิเสธทุกคำขอเมื่อยังไม่ได้ตั้ง secret จริง", () => {
    expect(isValidCronSecret("change-me-random-string", "change-me-random-string")).toBe(false);
    expect(isValidCronSecret("short", "short")).toBe(false);
    expect(isValidCronSecret("", undefined)).toBe(false);
  });
});
