import { describe, expect, it } from "vitest";
import {
  MOCK_STUDENT_COUNT,
  MOCK_TEST_CASES,
  generateMockStudents,
  queryMockStudents,
} from "@/lib/integrations/registry/mock-data";
import { registryStudentSchema } from "@/lib/integrations/registry/types";
import { isValidPassportNo, isValidThaiCitizenId } from "@/lib/validations/identifiers";

const NOW = new Date("2026-09-15T08:00:00.000Z");
const students = generateMockStudents(NOW);

describe("ข้อมูล Mock Registry", () => {
  it("มีอย่างน้อย 200 ราย รหัสนักศึกษาไม่ซ้ำ และผ่าน Zod DTO ทุกระเบียน", () => {
    expect(students.length).toBe(MOCK_STUDENT_COUNT);
    expect(students.length).toBeGreaterThanOrEqual(200);
    expect(new Set(students.map((s) => s.studentCode)).size).toBe(students.length);
    for (const s of students) {
      expect(registryStudentSchema.safeParse(s).success, s.studentCode).toBe(true);
    }
  });

  it("เลขบัตรผ่าน checksum และพาสปอร์ตถูกรูปแบบ", () => {
    for (const s of students) {
      if (s.citizenId) expect(isValidThaiCitizenId(s.citizenId), s.studentCode).toBe(true);
      if (s.passportNo) expect(isValidPassportNo(s.passportNo), s.studentCode).toBe(true);
    }
  });

  it("สร้างซ้ำได้ชุดเดิม (deterministic)", () => {
    expect(generateMockStudents(NOW)).toEqual(students);
  });

  it("ครอบคลุมทุกเคสที่ spec F-DATA-04 กำหนด", () => {
    const statuses = new Set(students.map((s) => s.status));
    expect(statuses).toEqual(new Set(["GRADUATED", "STUDYING", "WITHDRAWN", "REVOKED"]));

    expect(students.some((s) => s.honors === "FIRST_CLASS")).toBe(true);
    expect(students.some((s) => s.honors === "SECOND_CLASS")).toBe(true);
    expect(students.some((s) => s.citizenId === null && s.passportNo !== null)).toBe(true);
    expect(students.some((s) => s.requiresManualReview)).toBe(true);

    const byName = Map.groupBy(students, (s) => `${s.firstNameTh} ${s.lastNameTh}`);
    const duplicateName = [...byName.values()].find(
      (group) => new Set(group.map((s) => s.citizenId)).size > 1,
    );
    expect(duplicateName).toBeDefined();

    const byCitizen = Map.groupBy(
      students.filter((s) => s.citizenId),
      (s) => s.citizenId,
    );
    expect([...byCitizen.values()].some((group) => group.length > 1)).toBe(true);
  });

  it("เคสทดสอบที่ประกาศไว้มีอยู่จริงในชุดข้อมูล", () => {
    for (const c of MOCK_TEST_CASES) {
      const student = students.find((s) => s.studentCode === c.studentCode);
      expect(student, c.label).toBeDefined();
      const identifier = c.searchType === "CITIZEN_ID" ? student?.citizenId : student?.passportNo;
      expect(identifier).toBe(c.identifier);
    }
  });

  it("GRADUATED ทุกคนที่ไม่ใช่ข้อมูลเก่ามีวันสำเร็จการศึกษา และไม่มีวันที่ในอนาคต", () => {
    for (const s of students) {
      if (s.status === "STUDYING" || s.status === "WITHDRAWN") {
        expect(s.graduationDate, s.studentCode).toBeNull();
      }
      if (s.graduationDate) expect(Date.parse(s.graduationDate)).toBeLessThan(NOW.getTime());
      expect(Date.parse(s.updatedAt)).toBeLessThanOrEqual(NOW.getTime());
    }
  });
});

describe("queryMockStudents", () => {
  it("แบ่งหน้าได้ครบโดยไม่ซ้ำ", () => {
    const seen: string[] = [];
    for (let page = 1; ; page++) {
      const result = queryMockStudents(students, { page, pageSize: 70 });
      seen.push(...result.items.map((s) => s.studentCode));
      if (!result.hasMore) break;
    }
    expect(seen).toEqual(students.map((s) => s.studentCode));
  });

  it("updatedSince คืนเฉพาะระเบียนที่เปลี่ยนหลังเวลานั้น", () => {
    const since = new Date("2026-09-14T00:00:00.000Z");
    const result = queryMockStudents(students, { page: 1, pageSize: 1000, updatedSince: since });
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThan(students.length);
    expect(result.items.every((s) => Date.parse(s.updatedAt) > since.getTime())).toBe(true);
  });
});
