import { z } from "zod";
import { RegistryError } from "./errors";

// สัญญาข้อมูลกับระบบทะเบียน (F-DATA-03) — ยังไม่มี spec จริง จึงกำหนดรูปแบบเองและใช้เป็นร่างเอกสารขอ API (F-OPS-08)
// เปลี่ยน spec จริงเมื่อไร ให้แก้เฉพาะไฟล์นี้ + http-client.ts โดย service อื่นไม่กระทบ

const isoDate = z.iso.date();

export const registryStudentSchema = z
  .object({
    studentCode: z.string().regex(/^\d{10}$/),
    citizenId: z
      .string()
      .regex(/^\d{13}$/)
      .nullable(),
    passportNo: z
      .string()
      .regex(/^[A-Z0-9]{6,9}$/)
      .nullable(),
    prefixTh: z.string().max(50).nullable(),
    firstNameTh: z.string().min(1).max(100),
    lastNameTh: z.string().min(1).max(100),
    prefixEn: z.string().max(50).nullable(),
    firstNameEn: z.string().max(100).nullable(),
    lastNameEn: z.string().max(100).nullable(),
    educationLevel: z.enum(["BACHELOR", "MASTER", "DOCTORAL"]),
    degreeNameTh: z.string().min(1).max(200),
    degreeNameEn: z.string().max(200).nullable(),
    programTh: z.string().min(1).max(300),
    programEn: z.string().max(300).nullable(),
    majorTh: z.string().max(200).nullable(),
    majorEn: z.string().max(200).nullable(),
    facultyTh: z.string().min(1).max(200),
    facultyEn: z.string().max(200).nullable(),
    gpa: z.number().min(0).max(4).nullable(),
    honors: z.enum(["FIRST_CLASS", "SECOND_CLASS"]).nullable(),
    status: z.enum(["GRADUATED", "STUDYING", "WITHDRAWN", "REVOKED"]),
    graduationDate: isoDate.nullable(),
    councilApprovalDate: isoDate.nullable(),
    requiresManualReview: z.boolean().default(false),
    // เวลาที่ระเบียนเปลี่ยนล่าสุดฝั่งทะเบียน — ใช้ทำ incremental sync และข้ามระเบียนที่ไม่เปลี่ยน
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .refine((s) => s.citizenId !== null || s.passportNo !== null, {
    message: "ต้องมีเลขบัตรประชาชนหรือเลขหนังสือเดินทางอย่างน้อยหนึ่งค่า",
    path: ["citizenId"],
  });

export type RegistryStudent = z.infer<typeof registryStudentSchema>;

// ระเบียนที่ client ทุกตัวส่งให้ sync — สัญญา HTTP เดิม (RegistryStudent) เป็นกรณีเฉพาะที่ข้อมูลครบ
// Keystone ไม่มีเวลาแก้ไขล่าสุดและวันสำเร็จการศึกษา จึงมีฟิลด์เสริมด้านล่าง
export type SyncStudent = Omit<RegistryStudent, "updatedAt" | "studentCode"> & {
  studentCode: string;
  updatedAt: string | null;
  graduationTerm?: string | null;
  registryStatus?: string | null;
  sourceLevel?: number | null;
  sourceBatch?: number | null;
  // false = ยังขาดข้อมูลรายละเอียด (ชื่อไทย/GPAX) ต้องเรียก enrichStudent ก่อนอนุมัติอัตโนมัติได้
  detailComplete?: boolean;
};

// ตำแหน่งของระเบียนในต้นทาง — Keystone ค้นรายคนด้วยรหัสอย่างเดียวไม่ได้
export type StudentLocator = { sourceLevel: number | null; sourceBatch: number | null };

export type RegistryCapabilities = {
  // ต้นทางส่งวันสภาอนุมัติปริญญา → กฎ auto-approve บังคับวันสำเร็จการศึกษา + วันสภาอนุมัติ (spec ข้อ 4.2)
  councilApprovalDate: boolean;
  // รองรับ updatedSince (sync เฉพาะที่เปลี่ยน)
  incrementalSync: boolean;
};

const pageEnvelopeSchema = z.object({
  items: z.array(z.unknown()),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type InvalidRegistryRecord = { studentCode: string | null; issues: string[] };

export type RegistryStudentPage = {
  students: SyncStudent[];
  // ระเบียนที่รูปแบบผิด — ข้ามไปทีละรายการ ไม่ทำให้ทั้งหน้าล้ม
  invalid: InvalidRegistryRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type ListStudentsParams = {
  page: number;
  pageSize: number;
  updatedSince?: Date;
};

export interface RegistryClient {
  readonly name: "MockRegistryClient" | "HttpRegistryClient" | "KeystoneRegistryClient";
  readonly endpoint: string;
  readonly capabilities: RegistryCapabilities;
  listStudents(params: ListStudentsParams): Promise<RegistryStudentPage>;
  // null = ไม่พบระเบียนในระบบทะเบียน
  getStudent(studentCode: string, locator?: StudentLocator): Promise<SyncStudent | null>;
  // เติมข้อมูลรายละเอียดที่รายการแบบชุดไม่มี (Keystone: ชื่อไทย + GPAX) — client ที่ข้อมูลครบไม่ต้องมี
  enrichStudent?(student: SyncStudent): Promise<SyncStudent>;
  // throw RegistryError เมื่อเชื่อมต่อไม่ได้
  ping(): Promise<void>;
}

export function parseStudentPage(json: unknown): RegistryStudentPage {
  const envelope = pageEnvelopeSchema.safeParse(json);
  if (!envelope.success) {
    throw new RegistryError("BAD_RESPONSE", "รูปแบบ response ของรายการนักศึกษาไม่ถูกต้อง");
  }

  const students: RegistryStudent[] = [];
  const invalid: InvalidRegistryRecord[] = [];
  for (const item of envelope.data.items) {
    const parsed = registryStudentSchema.safeParse(item);
    if (parsed.success) {
      students.push(parsed.data);
    } else {
      const code = (item as { studentCode?: unknown } | null)?.studentCode;
      invalid.push({
        studentCode: typeof code === "string" ? code : null,
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
  }

  const { page, pageSize, total, hasMore } = envelope.data;
  return { students, invalid, page, pageSize, total, hasMore };
}

export function parseStudent(json: unknown): RegistryStudent {
  const parsed = registryStudentSchema.safeParse(json);
  if (!parsed.success) {
    throw new RegistryError("BAD_RESPONSE", "รูปแบบข้อมูลนักศึกษาไม่ถูกต้อง");
  }
  return parsed.data;
}
