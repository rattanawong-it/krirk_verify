import { describe, expect, it, vi } from "vitest";
import { RegistryError } from "@/lib/integrations/registry/errors";
import { KeystoneRegistryClient } from "@/lib/integrations/registry/keystone-client";
import {
  applyAcademicRecord,
  keystonePartitions,
  mapKeystoneStatus,
  parseKeystoneBatch,
  parseKeystoneTerm,
  toKeystoneStudent,
} from "@/lib/integrations/registry/keystone-mapper";

// ข้อมูลสมมติทั้งหมด — รูปแบบตามที่สำรวจจาก Keystone จริง (docs/registry-keystone-gap.md ข้อ 5)
const item = {
  citizenNumber: "3101500451201",
  passport: null,
  code: "64010001",
  batch: 641,
  title: "Ms.",
  firstName: "Siriporn",
  middleName: null,
  lastName: "Jaidee",
  nativeFirstName: "ศิริพร",
  nativeMiddleName: null,
  nativeLastName: "ใจดี",
  status: "สำเร็จการศึกษา",
  statusTerm: "2/2023 [SEMESTER]",
  statusDate: "15/03/2024 10:30",
  degree: " Bachelor of Business Administration ",
  faculty: "Liberal  Arts",
  mainCurriculumName: "Bachelor of Business  Administration (Marketing)",
  // ฟิลด์เกินจำเป็นที่ต้องไม่หลุดเข้าระบบ
  religion: "Buddhism",
  currentAddress: "123 ถนนสมมติ",
  fatherFirstName: "Somchai",
};

describe("keystonePartitions", () => {
  it("ค่าเริ่มต้น: รุ่น 653 (เริ่มใช้ Keystone) ขึ้นไป ทุกระดับ × ทีละปี เทอม 1–3", () => {
    const partitions = keystonePartitions();
    // ปี 65 (เฉพาะเทอม 3) ถึงปี 99
    expect(partitions).toHaveLength(3 * 35);
    expect(partitions[0]).toEqual({ level: 1, startBatch: 653, endBatch: 653 });
    expect(partitions[1]).toEqual({ level: 1, startBatch: 661, endBatch: 663 });
    expect(partitions.at(-1)).toEqual({ level: 3, startBatch: 991, endBatch: 993 });
    expect(keystonePartitions("649-640")).toEqual(partitions);
    expect(keystonePartitions("abc")).toEqual(partitions);
  });

  it("KEYSTONE_BATCH_RANGE: sync รุ่นเก่าภายหลัง แบ่งทีละปีและตัดเทอมนอกช่วง", () => {
    expect(keystonePartitions("640-649")).toEqual([
      { level: 1, startBatch: 641, endBatch: 643 },
      { level: 2, startBatch: 641, endBatch: 643 },
      { level: 3, startBatch: 641, endBatch: 643 },
    ]);
    const older = keystonePartitions("561-652").filter((p) => p.level === 1);
    expect(older[0]).toEqual({ level: 1, startBatch: 561, endBatch: 563 });
    expect(older.at(-1)).toEqual({ level: 1, startBatch: 651, endBatch: 652 });
    expect(older).toHaveLength(10);
  });
});

describe("parseKeystoneBatch", () => {
  it("หลัก 1–2 = ปี พ.ศ. · หลักที่ 3 = เทอม 1–3", () => {
    expect(parseKeystoneBatch(641)).toEqual({ buddhistYear: 2564, term: 1 });
    expect(parseKeystoneBatch(693)).toEqual({ buddhistYear: 2569, term: 3 });
  });

  it.each([0, null, 300, 644, 1000])("%s ไม่ตรงรูปแบบ", (batch) => {
    expect(parseKeystoneBatch(batch)).toBeNull();
  });

  it("ระเบียนที่รุ่นไม่ตรงรูปแบบไม่มี sourceBatch (ดึงรายคนซ้ำไม่ได้)", () => {
    const result = toKeystoneStudent({ ...item, batch: 300 }, 1);
    expect(result.ok && result.student.sourceBatch).toBeNull();
  });
});

describe("mapKeystoneStatus", () => {
  it.each([
    ["สำเร็จการศึกษา", "GRADUATED", false],
    ["กำลังศึกษา", "STUDYING", false],
    ["นักศึกษาใหม่", "STUDYING", false],
    ["นักศึกษาใหม่ลงทะเบียน", "STUDYING", false],
    ["ลาพักการศึกษา", "STUDYING", false],
    ["ลาออก", "WITHDRAWN", false],
    ["ลาออกกรณีอื่นๆ", "WITHDRAWN", false],
    ["ลาออกกรณีพิเศษต่อสถาบันอื่น", "WITHDRAWN", false],
    ["พ้นสภาพ", "WITHDRAWN", false],
    ["พ้นสภาพกรณีขาดการติดต่อ", "WITHDRAWN", false],
    ["พ้นสภาพกรณีเกรดต่ำกว่าเกณฑ์", "WITHDRAWN", false],
    ["พ้นสภาพกรณีวุฒิการศึกษาไม่ถูกต้อง", "WITHDRAWN", false],
    ["สถานะที่ไม่รู้จัก", "STUDYING", true],
    [null, "STUDYING", true],
  ] as const)("%s → %s (ตรวจเอง %s)", (text, status, requiresManualReview) => {
    expect(mapKeystoneStatus(text)).toEqual({ status, requiresManualReview });
  });
});

describe("parseKeystoneTerm", () => {
  it("ตัดชนิดภาคออก", () => {
    expect(parseKeystoneTerm("2/2023 [SEMESTER]")).toBe("2/2023");
    expect(parseKeystoneTerm("1/2025 [SEMESTER_A]")).toBe("1/2025");
    expect(parseKeystoneTerm("Spring 2024")).toBeNull();
    expect(parseKeystoneTerm(null)).toBeNull();
  });
});

describe("toKeystoneStudent", () => {
  it("แปลงระเบียนผู้สำเร็จการศึกษา ตัดช่องว่าง และไม่เก็บฟิลด์เกินจำเป็น", () => {
    const result = toKeystoneStudent(item, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const student = result.student;

    expect(student).toMatchObject({
      studentCode: "64010001",
      citizenId: "3101500451201",
      passportNo: null,
      prefixTh: "นางสาว",
      firstNameTh: "ศิริพร",
      lastNameTh: "ใจดี",
      prefixEn: "Ms.",
      firstNameEn: "Siriporn",
      educationLevel: "BACHELOR",
      degreeNameEn: "Bachelor of Business Administration",
      programEn: "Bachelor of Business Administration (Marketing)",
      facultyEn: "Liberal Arts",
      status: "GRADUATED",
      graduationDate: null,
      councilApprovalDate: null,
      graduationTerm: "2/2023",
      registryStatus: "สำเร็จการศึกษา",
      updatedAt: null,
      sourceLevel: 1,
      sourceBatch: 641,
      detailComplete: false,
    });
    const serialized = JSON.stringify(student);
    expect(serialized).not.toContain("Buddhism");
    expect(serialized).not.toContain("ถนนสมมติ");
    expect(serialized).not.toContain("Somchai");
  });

  it("ภาคที่สำเร็จมีเฉพาะผู้สำเร็จการศึกษา", () => {
    const result = toKeystoneStudent({ ...item, status: "กำลังศึกษา" }, 2);
    expect(result.ok && result.student).toMatchObject({
      status: "STUDYING",
      graduationTerm: null,
      educationLevel: "MASTER",
    });
  });

  it("ไม่มีชื่อไทย → ใช้ชื่ออังกฤษและไม่ใส่คำนำหน้าไทย", () => {
    const result = toKeystoneStudent({ ...item, nativeFirstName: null, nativeLastName: null }, 1);
    expect(result.ok && result.student).toMatchObject({
      prefixTh: null,
      firstNameTh: "Siriporn",
      lastNameTh: "Jaidee",
    });
  });

  it("เลขบัตร 12 หลักใช้ไม่ได้ → ใช้พาสปอร์ตที่ normalize แล้ว", () => {
    const result = toKeystoneStudent(
      { ...item, citizenNumber: "310150045120", passport: "aa 1234567" },
      1,
    );
    expect(result.ok && result.student).toMatchObject({
      citizenId: null,
      passportNo: "AA1234567",
    });
  });

  it("ไม่มีเลขบัตรหรือพาสปอร์ตที่ใช้ได้ / รหัสผิดรูปแบบ → ระเบียนไม่ถูกต้อง", () => {
    expect(toKeystoneStudent({ ...item, citizenNumber: null, passport: "---" }, 1)).toMatchObject({
      ok: false,
      invalid: { studentCode: "64010001" },
    });
    expect(toKeystoneStudent({ ...item, code: "  " }, 1)).toMatchObject({ ok: false });
    expect(toKeystoneStudent({ ...item, degree: null, mainCurriculumName: null }, 1)).toMatchObject(
      {
        ok: false,
      },
    );
  });

  it("ผู้ที่ยังไม่สำเร็จการศึกษาไม่มีหลักสูตรได้ (เจ้าหน้าที่ยังเห็นสถานภาพ)", () => {
    const result = toKeystoneStudent(
      {
        ...item,
        status: "นักศึกษาใหม่ลงทะเบียน",
        degree: null,
        mainCurriculumName: null,
        faculty: null,
      },
      1,
    );
    expect(result.ok && result.student).toMatchObject({
      status: "STUDYING",
      degreeNameTh: "",
      facultyTh: "",
    });
  });
});

describe("applyAcademicRecord", () => {
  it("เติมชื่อไทย/อังกฤษของวุฒิและคณะ + GPAX แล้วถือว่ารายละเอียดครบ", () => {
    const base = toKeystoneStudent(item, 1);
    if (!base.ok) throw new Error("ต้องแปลงได้");
    const enriched = applyAcademicRecord(base.student, {
      faculty: "บริหารธุรกิจ",
      facultyEN: "Business Administration",
      curriculum: "บริหารธุรกิจบัณฑิต สาขาวิชาการตลาด ",
      curriculumEN: "Bachelor of Business Administration (Marketing)",
      gpax: 3.456,
    });
    expect(enriched).toMatchObject({
      degreeNameTh: "บริหารธุรกิจบัณฑิต สาขาวิชาการตลาด",
      degreeNameEn: "Bachelor of Business Administration (Marketing)",
      facultyTh: "บริหารธุรกิจ",
      facultyEn: "Business Administration",
      gpa: 3.46,
      detailComplete: true,
    });
    expect(applyAcademicRecord(base.student, { facultyEN: "" }).facultyEn).toBe("Liberal Arts");
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(responses: (() => Response)[]) {
  const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error("ไม่มี response สำรองในเทสต์");
    return next();
  });
  const client = new KeystoneRegistryClient({
    baseUrl: "https://keystone.example.ac.th/",
    apiKey: "test-api-key",
    fetch: fetchMock as unknown as typeof fetch,
    sleep: async () => {},
  });
  return { client, fetchMock };
}

describe("KeystoneRegistryClient", () => {
  it("หน้าที่ 1 = ป.ตรี รุ่น 653 ส่ง x-api-key และแยกระเบียนไม่ถูกต้อง", async () => {
    const { client, fetchMock } = setup([
      () => json({ code: "200", message: "Success", data: { items: [item, { code: "X1" }] } }),
    ]);
    const page = await client.listStudents({ page: 1, pageSize: 500 });

    expect(page.students).toHaveLength(1);
    expect(page.invalid).toEqual([{ studentCode: "X1", issues: expect.any(Array) }]);
    expect(page.hasMore).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://keystone.example.ac.th/StudentApi/StudentStatusReport?AcademicLevelId=1&StartStudentBatch=653&EndStudentBatch=653",
    );
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("test-api-key");
  });

  it("หน้าสุดท้ายไม่มีต่อ · ช่วงรุ่นที่ว่างไม่ใช่ข้อผิดพลาด", async () => {
    const { client } = setup([
      () => json({ code: "200", message: "Success", data: { items: [] } }),
    ]);
    const page = await client.listStudents({ page: 105, pageSize: 500 });
    expect(page).toMatchObject({ students: [], invalid: [], hasMore: false });
  });

  it("รหัสผิดพลาดใน envelope → BAD_RESPONSE ไม่ retry", async () => {
    const { client, fetchMock } = setup([
      () =>
        json(
          { code: "422API002", message: "Invalid Parameters: Must Specify [AcademicLevelId]" },
          400,
        ),
    ]);
    await expect(client.ping()).rejects.toMatchObject({
      code: "BAD_RESPONSE",
      message: expect.stringContaining("422API002"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("401 → UNAUTHORIZED", async () => {
    const { client } = setup([() => new Response("", { status: 401 })]);
    await expect(client.ping()).rejects.toBeInstanceOf(RegistryError);
  });

  it("getStudent ต้องรู้ระดับและรุ่น แล้วค้นในรุ่นนั้น", async () => {
    const { client, fetchMock } = setup([
      () => json({ code: "200", message: "Success", data: { items: [item] } }),
    ]);
    expect(await client.getStudent("64010001")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    const student = await client.getStudent("64010001", { sourceLevel: 1, sourceBatch: 641 });
    expect(student?.citizenId).toBe("3101500451201");
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      "StartStudentBatch=641&EndStudentBatch=641",
    );
  });

  it("enrichStudent: ไม่พบ (400API003) คืนข้อมูลเดิมที่ยังไม่ครบ", async () => {
    const base = toKeystoneStudent(item, 1);
    if (!base.ok) throw new Error("ต้องแปลงได้");
    const { client, fetchMock } = setup([
      () => json({ code: "400API003", message: "Students Not Found", data: null }, 400),
    ]);
    const result = await client.enrichStudent(base.student);
    expect(result.detailComplete).toBe(false);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://keystone.example.ac.th/StudentApi/StudentAcademicRecord?studentId=64010001",
    );
  });
});
