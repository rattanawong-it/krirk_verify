import { defaultSleep, requestJson } from "./http-request";
import {
  type ListStudentsParams,
  type RegistryClient,
  type RegistryStudent,
  type RegistryStudentPage,
  parseStudent,
  parseStudentPage,
} from "./types";

// F-DATA-05: client ของ API ระบบทะเบียนตามสัญญาที่เราเสนอ (docs/registry-api-spec.md)
// path และรูปแบบ response ยึดตาม Mock API (/api/mock/registry) · ระบบจริงของมหาวิทยาลัยใช้ keystone-client.ts

export type HttpRegistryClientOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export class HttpRegistryClient implements RegistryClient {
  readonly name = "HttpRegistryClient" as const;
  readonly capabilities = { councilApprovalDate: true, incrementalSync: true };
  readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: HttpRegistryClientOptions) {
    this.endpoint = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey || undefined;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async listStudents({
    page,
    pageSize,
    updatedSince,
  }: ListStudentsParams): Promise<RegistryStudentPage> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (updatedSince) query.set("updatedSince", updatedSince.toISOString());
    return parseStudentPage(await this.request(`/students?${query}`));
  }

  async getStudent(studentCode: string): Promise<RegistryStudent | null> {
    const json = await this.request(`/students/${encodeURIComponent(studentCode)}`, {
      notFoundAsNull: true,
    });
    return json === null ? null : parseStudent(json);
  }

  async ping(): Promise<void> {
    await this.request("/health");
  }

  private async request(path: string, { notFoundAsNull = false } = {}): Promise<unknown> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const { status, body } = await requestJson(`${this.endpoint}${path}`, {
      headers,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
      fetch: this.fetchImpl,
      sleep: this.sleep,
      accept: (code) => notFoundAsNull && code === 404,
    });
    return status === 404 ? null : body;
  }
}
