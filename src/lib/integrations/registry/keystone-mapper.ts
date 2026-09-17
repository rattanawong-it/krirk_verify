import { z } from "zod";
import { isRegistryStudentCode } from "@/lib/validations/identifiers";
import type { InvalidRegistryRecord, SyncStudent } from "./types";

// แปลงข้อมูล Keystone Open API → SyncStudent (pure function เพื่อ unit test ได้)
// โครงสร้างจริงสำรวจเมื่อ 2026-09-17 — ดู docs/registry-keystone-gap.md ข้อ 5
// PDPA: StudentStatusReport คืนข้อมูลเกินจำเป็น (ที่อยู่ ครอบครัว ศาสนา ฯลฯ) — schema ด้านล่างเลือกเฉพาะฟิลด์ที่ใช้
// และ Zod ตัดฟิลด์อื่นทิ้งทันที ห้าม log response ดิบ

// Keystone ยังไม่ส่งวันสภาอนุมัติปริญญา → ปิดเงื่อนไขนี้ในกฎ auto-approve ชั่วคราว
// เมื่อ API เพิ่มฟิลด์แล้ว: map ค่าใน toKeystoneStudent และเปลี่ยนเป็น true เพื่อกลับไปใช้กฎเดิม (spec ข้อ 4.2)
export const KEYSTONE_PROVIDES_COUNCIL_APPROVAL = false;

export const KEYSTONE_LEVELS = { 1: "BACHELOR", 2: "MASTER", 3: "DOCTORAL" } as const;
export type KeystoneLevel = keyof typeof KEYSTONE_LEVELS;

// รุ่น (batch) = เลข 3 หลัก: หลักที่ 1–2 = ปี พ.ศ. 2 หลัก · หลักที่ 3 = เทอม (1–3 เท่านั้น) เช่น 641 = 2564 เทอม 1
// แบ่งคำขอทีละปี (YY1–YY3) ให้แต่ละ response ไม่เกินไม่กี่ MB · รุ่น 0 = นักศึกษาใหม่ยังไม่มีรุ่น ไม่ดึง
// ค่าที่เทอมไม่ใช่ 1–3 ในข้อมูลจริง (เช่น 300) ไม่ถูกดึง — ต้องให้ฝ่ายทะเบียนแก้ที่ Keystone
export type KeystonePartition = { level: KeystoneLevel; startBatch: number; endBatch: number };

const TERMS_PER_YEAR = 3;
const LAST_BATCH = 993;

// รุ่นแรกที่เริ่มใช้ระบบ Keystone (2565 เทอม 3) — ค่าเริ่มต้นของ sync
// รุ่นก่อนหน้า (ข้อมูลที่ย้ายมา) ยังมีใน API: sync ภายหลังด้วย KEYSTONE_BATCH_RANGE เช่น "561-652"
export const KEYSTONE_FIRST_BATCH = 653;

// batchRange (env KEYSTONE_BATCH_RANGE เช่น "561-652") = ช่วงรุ่นที่จะดึง · เว้นว่างหรือผิดรูปแบบ = 653 ขึ้นไป
// ทุกกรณีแบ่งทีละปี (ตัดเทอมที่อยู่นอกช่วง) ให้แต่ละ response ไม่ใหญ่เกิน
export function keystonePartitions(batchRange?: string): KeystonePartition[] {
  const limit = batchRange?.trim().match(/^(\d{1,3})-(\d{1,3})$/);
  const custom = limit && Number(limit[1]) >= 1 && Number(limit[1]) <= Number(limit[2]);
  const start = custom ? Number(limit[1]) : KEYSTONE_FIRST_BATCH;
  const end = custom ? Math.min(Number(limit[2]), LAST_BATCH) : LAST_BATCH;

  const years: [number, number][] = [];
  for (let year = Math.floor(start / 10); year <= Math.floor(end / 10); year++) {
    const first = Math.max(start, year * 10 + 1);
    const last = Math.min(end, year * 10 + TERMS_PER_YEAR);
    if (first <= last) years.push([first, last]);
  }
  return ([1, 2, 3] as const).flatMap((level) =>
    years.map(([startBatch, endBatch]) => ({ level, startBatch, endBatch })),
  );
}

// 641 → { buddhistYear: 2564, term: 1 } · ไม่ตรงรูปแบบ → null
export function parseKeystoneBatch(
  batch: number | null | undefined,
): { buddhistYear: number; term: number } | null {
  if (!batch || !Number.isInteger(batch) || batch < 11 || batch > 993) return null;
  const term = batch % 10;
  if (term < 1 || term > TERMS_PER_YEAR) return null;
  return { buddhistYear: 2500 + Math.floor(batch / 10), term };
}

const nullableString = z.string().nullish();

export const keystoneEnvelopeSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String),
  message: z.string().nullish(),
  data: z.unknown().nullish(),
});

const keystoneItemSchema = z.object({
  code: nullableString,
  citizenNumber: nullableString,
  passport: nullableString,
  title: nullableString,
  firstName: nullableString,
  middleName: nullableString,
  lastName: nullableString,
  nativeFirstName: nullableString,
  nativeMiddleName: nullableString,
  nativeLastName: nullableString,
  status: nullableString,
  statusTerm: nullableString,
  degree: nullableString,
  faculty: nullableString,
  mainCurriculumName: nullableString,
  batch: z.number().int().nullish(),
});

export const keystoneReportDataSchema = z.object({ items: z.array(z.unknown()) });

export const keystoneAcademicRecordSchema = z.object({
  faculty: nullableString,
  facultyEN: nullableString,
  curriculum: nullableString,
  curriculumEN: nullableString,
  gpax: z.number().nullish(),
});

export type KeystoneAcademicRecord = z.infer<typeof keystoneAcademicRecordSchema>;

// ข้อมูลจริงมีช่องว่างหน้า/หลังและช่องว่างซ้อน เช่น "Liberal  Arts", " Bachelor of Business Administration"
export function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text : null;
}

function joinNames(...parts: (string | null | undefined)[]): string | null {
  return clean(parts.filter(Boolean).join(" "));
}

const TITLE_TH: Record<string, string> = {
  "Mr.": "นาย",
  "Ms.": "นางสาว",
  Miss: "นางสาว",
  "Mrs.": "นาง",
};

type MappedStatus = Pick<SyncStudent, "status" | "requiresManualReview">;

// 12 ค่าที่พบจริง — ค่าใหม่ที่ไม่รู้จักให้เจ้าหน้าที่ตรวจเสมอ ดีกว่าอนุมัติหรือปฏิเสธผิด
const STUDYING_STATUSES = new Set([
  "กำลังศึกษา",
  "นักศึกษาใหม่",
  "นักศึกษาใหม่ลงทะเบียน",
  "ลาพักการศึกษา",
]);

export function mapKeystoneStatus(text: string | null): MappedStatus {
  const status = clean(text) ?? "";
  if (status === "สำเร็จการศึกษา") return { status: "GRADUATED", requiresManualReview: false };
  if (status.startsWith("ลาออก") || status.startsWith("พ้นสภาพ")) {
    return { status: "WITHDRAWN", requiresManualReview: false };
  }
  if (STUDYING_STATUSES.has(status)) return { status: "STUDYING", requiresManualReview: false };
  return { status: "STUDYING", requiresManualReview: true };
}

// "2/2023 [SEMESTER]" → "2/2023" (ภาค/ปี ค.ศ.)
export function parseKeystoneTerm(value: string | null | undefined): string | null {
  const match = value?.trim().match(/^([1-3])\/(\d{4})\b/);
  return match ? `${match[1]}/${match[2]}` : null;
}

function citizenIdOf(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  // พบเลข 12 หลักในข้อมูลจริง — ค้นหาไม่ได้อยู่แล้ว (ช่องค้นหาบังคับ 13 หลัก + checksum)
  return /^\d{13}$/.test(digits) ? digits : null;
}

function passportOf(value: string | null | undefined, citizenId: string | null): string | null {
  const normalized = value?.replace(/[\s-]/g, "").toUpperCase() ?? "";
  if (!/^[A-Z0-9]{5,20}$/.test(normalized) || normalized === citizenId) return null;
  return normalized;
}

export function toKeystoneStudent(
  raw: unknown,
  level: KeystoneLevel,
): { ok: true; student: SyncStudent } | { ok: false; invalid: InvalidRegistryRecord } {
  const parsed = keystoneItemSchema.safeParse(raw);
  const code = parsed.success ? clean(parsed.data.code) : null;
  const fail = (...issues: string[]) =>
    ({ ok: false, invalid: { studentCode: code, issues } }) as const;
  if (!parsed.success) {
    return fail(...parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }

  const item = parsed.data;
  if (!code || !isRegistryStudentCode(code)) return fail("code: รูปแบบรหัสนักศึกษาไม่ถูกต้อง");

  const citizenId = citizenIdOf(item.citizenNumber);
  const passportNo = passportOf(item.passport, citizenId);
  if (!citizenId && !passportNo)
    return fail("citizenNumber: ไม่มีเลขบัตรหรือเลขหนังสือเดินทางที่ใช้ได้");

  const firstNameEn = joinNames(item.firstName, item.middleName);
  const lastNameEn = clean(item.lastName);
  const nativeFirst = joinNames(item.nativeFirstName, item.nativeMiddleName);
  const nativeLast = clean(item.nativeLastName);
  // นักศึกษาต่างชาติบางส่วนไม่มีชื่อภาษาไทย → ใช้ชื่ออังกฤษ
  const hasNativeName = Boolean(nativeFirst);
  const firstNameTh = nativeFirst ?? firstNameEn;
  const lastNameTh = (hasNativeName ? nativeLast : lastNameEn) ?? "";
  if (!firstNameTh) return fail("firstName: ไม่มีชื่อ");

  const { status, requiresManualReview } = mapKeystoneStatus(item.status ?? null);
  const degreeEn = clean(item.degree);
  const programEn = clean(item.mainCurriculumName);
  const facultyEn = clean(item.faculty);
  // นักศึกษาใหม่/กำลังศึกษาบางส่วนยังไม่มีหลักสูตร — เก็บไว้ให้เจ้าหน้าที่เห็นสถานภาพ แต่ผู้สำเร็จการศึกษาต้องมีวุฒิ
  const degree = degreeEn ?? programEn ?? "";
  if (status === "GRADUATED" && !degree) return fail("degree: ไม่มีชื่อปริญญาหรือหลักสูตร");
  if (status === "GRADUATED" && !facultyEn) return fail("faculty: ไม่มีชื่อคณะ");

  const prefixEn = clean(item.title);

  return {
    ok: true,
    student: {
      studentCode: code,
      citizenId,
      passportNo,
      prefixTh: hasNativeName && prefixEn ? (TITLE_TH[prefixEn] ?? null) : null,
      firstNameTh,
      lastNameTh,
      prefixEn,
      firstNameEn,
      lastNameEn,
      educationLevel: KEYSTONE_LEVELS[level],
      // ชื่อภาษาไทยมีเฉพาะ StudentAcademicRecord — เติมใน applyAcademicRecord
      degreeNameTh: degree,
      degreeNameEn: degreeEn,
      programTh: programEn ?? degree,
      programEn,
      majorTh: null,
      majorEn: null,
      facultyTh: facultyEn ?? "",
      facultyEn,
      gpa: null,
      honors: null,
      status,
      graduationDate: null,
      councilApprovalDate: null,
      graduationTerm: status === "GRADUATED" ? parseKeystoneTerm(item.statusTerm) : null,
      registryStatus: clean(item.status),
      requiresManualReview,
      updatedAt: null,
      sourceLevel: level,
      sourceBatch: parseKeystoneBatch(item.batch) ? item.batch! : null,
      detailComplete: false,
    },
  };
}

export function applyAcademicRecord(
  student: SyncStudent,
  record: KeystoneAcademicRecord,
): SyncStudent {
  const curriculumTh = clean(record.curriculum);
  const curriculumEn = clean(record.curriculumEN);
  const gpa = record.gpax;
  return {
    ...student,
    degreeNameTh: curriculumTh ?? student.degreeNameTh,
    degreeNameEn: curriculumEn ?? student.degreeNameEn,
    programTh: curriculumTh ?? student.programTh,
    programEn: curriculumEn ?? student.programEn,
    facultyTh: clean(record.faculty) ?? student.facultyTh,
    facultyEn: clean(record.facultyEN) ?? student.facultyEn,
    gpa: typeof gpa === "number" && gpa >= 0 && gpa <= 4 ? Math.round(gpa * 100) / 100 : null,
    detailComplete: true,
  };
}
