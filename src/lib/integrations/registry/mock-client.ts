import { RegistryError } from "./errors";
import { generateMockStudents, queryMockStudents } from "./mock-data";
import type {
  ListStudentsParams,
  RegistryClient,
  RegistryStudent,
  RegistryStudentPage,
} from "./types";

// F-DATA-04: เรียกข้อมูลสมมติในโปรเซสเดียวกัน (ไม่ผ่าน HTTP) — ถ้าต้องการทดสอบเส้นทาง HTTP จริง
// ให้ตั้ง REGISTRY_CLIENT=http ชี้ไปที่ /api/mock/registry ซึ่งใช้ข้อมูลชุดเดียวกัน

export class MockRegistryClient implements RegistryClient {
  readonly name = "MockRegistryClient" as const;
  readonly endpoint = "/api/mock/registry";
  private readonly enabled: boolean;
  private readonly now: () => Date;

  constructor(options: { enabled?: boolean; now?: () => Date } = {}) {
    this.enabled = options.enabled ?? true;
    this.now = options.now ?? (() => new Date());
  }

  // MOCK_REGISTRY_ENABLED=false = จำลองว่าระบบทะเบียนล่ม (ใช้ทดสอบข้อ 9.3)
  private ensureAvailable() {
    if (!this.enabled) {
      throw new RegistryError("UNAVAILABLE", "Mock Registry ถูกปิด (MOCK_REGISTRY_ENABLED=false)");
    }
  }

  async listStudents(params: ListStudentsParams): Promise<RegistryStudentPage> {
    this.ensureAvailable();
    const result = queryMockStudents(generateMockStudents(this.now()), params);
    return { ...result, students: result.items, invalid: [] };
  }

  async getStudent(studentCode: string): Promise<RegistryStudent | null> {
    this.ensureAvailable();
    return generateMockStudents(this.now()).find((s) => s.studentCode === studentCode) ?? null;
  }

  async ping(): Promise<void> {
    this.ensureAvailable();
  }
}
