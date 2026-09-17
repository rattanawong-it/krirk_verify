import { RegistryError } from "./errors";
import { defaultSleep, requestJson } from "./http-request";
import {
  KEYSTONE_PROVIDES_COUNCIL_APPROVAL,
  type KeystoneLevel,
  type KeystonePartition,
  applyAcademicRecord,
  keystoneAcademicRecordSchema,
  keystoneEnvelopeSchema,
  keystonePartitions,
  keystoneReportDataSchema,
  toKeystoneStudent,
} from "./keystone-mapper";
import type {
  InvalidRegistryRecord,
  ListStudentsParams,
  RegistryClient,
  RegistryStudentPage,
  StudentLocator,
  SyncStudent,
} from "./types";

// client ของ Keystone Open API (ระบบทะเบียนจริงของมหาวิทยาลัย) — REGISTRY_CLIENT=keystone
// - StudentStatusReport ไม่มีการแบ่งหน้า → "หน้า" ของ sync = ช่วง (ระดับการศึกษา × รุ่น) หนึ่งช่วง
// - ไม่มี updatedSince → sync เฉพาะที่เปลี่ยนทำงานแบบเต็มชุด (sync เทียบ HMAC เนื้อหาเพื่อข้ามระเบียนเดิม)
// - ชื่อไทย + GPAX มีเฉพาะ StudentAcademicRecord (รายคน) → enrichStudent

const NOT_FOUND_CODE = "400API003";

export type KeystoneRegistryClientOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  batchRange?: string;
};

export class KeystoneRegistryClient implements RegistryClient {
  readonly name = "KeystoneRegistryClient" as const;
  readonly capabilities = {
    councilApprovalDate: KEYSTONE_PROVIDES_COUNCIL_APPROVAL,
    incrementalSync: false,
  };
  readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly partitions: KeystonePartition[];

  constructor(options: KeystoneRegistryClientOptions) {
    this.endpoint = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey || undefined;
    // รุ่นเดียวของ ป.ตรี ~4 MB ใช้เวลา 2–4 วินาที — เผื่อเวลามากกว่าสัญญาเดิม
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.partitions = keystonePartitions(options.batchRange);
  }

  async listStudents({ page }: ListStudentsParams): Promise<RegistryStudentPage> {
    const partition = this.partitions[page - 1];
    const hasMore = page < this.partitions.length;
    if (!partition) return { students: [], invalid: [], page, pageSize: 0, total: 0, hasMore };

    const { students, invalid } = await this.fetchPartition(partition);
    const received = students.length + invalid.length;
    return { students, invalid, page, pageSize: received, total: received, hasMore };
  }

  async getStudent(studentCode: string, locator?: StudentLocator): Promise<SyncStudent | null> {
    const level = locator?.sourceLevel;
    const batch = locator?.sourceBatch;
    // ค้นด้วยรหัสอย่างเดียวไม่ได้ ต้องรู้ระดับและรุ่นจากการ sync ครั้งก่อน
    if (!isLevel(level) || batch === null || batch === undefined) return null;

    const { students, invalid } = await this.fetchPartition({
      level,
      startBatch: batch,
      endBatch: batch,
    });
    const student = students.find((s) => s.studentCode === studentCode);
    if (!student) {
      if (invalid.some((r) => r.studentCode === studentCode)) {
        throw new RegistryError("BAD_RESPONSE", "รูปแบบข้อมูลนักศึกษาไม่ถูกต้อง");
      }
      return null;
    }
    return student;
  }

  async enrichStudent(student: SyncStudent): Promise<SyncStudent> {
    const query = new URLSearchParams({ studentId: student.studentCode });
    const data = await this.request(`/StudentApi/StudentAcademicRecord?${query}`);
    if (data === null) return student;

    const record = keystoneAcademicRecordSchema.safeParse(data);
    if (!record.success) {
      throw new RegistryError("BAD_RESPONSE", "รูปแบบผลการเรียนของ Keystone ไม่ถูกต้อง");
    }
    return applyAcademicRecord(student, record.data);
  }

  // ไม่มี endpoint ตรวจสถานะ — ดึงช่วงรุ่นที่ไม่มีข้อมูล (ตอบเร็ว ~0.3 วินาที และไม่มีข้อมูลส่วนบุคคล)
  async ping(): Promise<void> {
    await this.request(this.reportPath({ level: 1, startBatch: 1, endBatch: 1 }));
  }

  private reportPath({ level, startBatch, endBatch }: KeystonePartition): string {
    const query = new URLSearchParams({
      AcademicLevelId: String(level),
      StartStudentBatch: String(startBatch),
      EndStudentBatch: String(endBatch),
    });
    return `/StudentApi/StudentStatusReport?${query}`;
  }

  private async fetchPartition(
    partition: KeystonePartition,
  ): Promise<{ students: SyncStudent[]; invalid: InvalidRegistryRecord[] }> {
    const body = await this.request(this.reportPath(partition));
    const data = keystoneReportDataSchema.safeParse(body ?? { items: [] });
    if (!data.success) {
      throw new RegistryError("BAD_RESPONSE", "รูปแบบรายการนักศึกษาของ Keystone ไม่ถูกต้อง");
    }

    const students: SyncStudent[] = [];
    const invalid: InvalidRegistryRecord[] = [];
    for (const item of data.data.items) {
      const mapped = toKeystoneStudent(item, partition.level);
      if (mapped.ok) students.push(mapped.student);
      else invalid.push(mapped.invalid);
    }
    return { students, invalid };
  }

  // คืน data ของ envelope · null = ไม่พบ (Keystone ตอบ HTTP 400 + code 400API003 แทน 404)
  private async request(path: string): Promise<unknown> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    const { status, body } = await requestJson(`${this.endpoint}${path}`, {
      headers,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
      fetch: this.fetchImpl,
      sleep: this.sleep,
      accept: (code) => code === 400,
    });

    const envelope = keystoneEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
      throw new RegistryError("BAD_RESPONSE", "response ของ Keystone ไม่มี envelope", { status });
    }
    const { code, message } = envelope.data;
    if (code === NOT_FOUND_CODE) return null;
    if (status !== 200 || code !== "200") {
      // message ของ Keystone เป็นข้อความระบบ (เช่น "Invalid Parameters") ไม่มีข้อมูลส่วนบุคคล
      throw new RegistryError(
        "BAD_RESPONSE",
        `Keystone ตอบกลับรหัส ${code}${message ? `: ${message.slice(0, 200)}` : ""}`,
        { status },
      );
    }
    return envelope.data.data ?? null;
  }
}

function isLevel(value: number | null | undefined): value is KeystoneLevel {
  return value === 1 || value === 2 || value === 3;
}
