import { RegistryError, type RegistryErrorCode } from "./errors";
import {
  type ListStudentsParams,
  type RegistryClient,
  type RegistryStudent,
  type RegistryStudentPage,
  parseStudent,
  parseStudentPage,
} from "./types";

// F-DATA-05: client ของ API ระบบทะเบียนจริง — timeout + retry แบบ exponential backoff + แปลง error เป็นรหัสกลาง
// path และรูปแบบ response ยึดตาม Mock API (/api/mock/registry) จนกว่าจะได้ spec จริง

export type HttpRegistryClientOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function codeForStatus(status: number): RegistryErrorCode {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "BAD_RESPONSE";
}

export class HttpRegistryClient implements RegistryClient {
  readonly name = "HttpRegistryClient" as const;
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

    for (let attempt = 1; ; attempt++) {
      let error: RegistryError;
      try {
        const response = await this.fetchImpl(`${this.endpoint}${path}`, {
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.ok) {
          try {
            return await response.json();
          } catch (cause) {
            throw new RegistryError("BAD_RESPONSE", "response ไม่ใช่ JSON", {
              status: response.status,
              attempts: attempt,
              cause,
            });
          }
        }
        if (response.status === 404 && notFoundAsNull) return null;

        error = new RegistryError(
          codeForStatus(response.status),
          `ระบบทะเบียนตอบกลับ HTTP ${response.status}`,
          { status: response.status, attempts: attempt },
        );
      } catch (cause) {
        if (cause instanceof RegistryError) throw cause;
        // AbortSignal.timeout โยน DOMException — บาง runtime ไม่ได้สืบทอด Error จึงดูจาก name
        const name = (cause as { name?: unknown } | null)?.name;
        const isTimeout = name === "TimeoutError" || name === "AbortError";
        error = isTimeout
          ? new RegistryError("TIMEOUT", `ระบบทะเบียนไม่ตอบกลับภายใน ${this.timeoutMs} ms`, {
              attempts: attempt,
              cause,
            })
          : new RegistryError("NETWORK", "เชื่อมต่อระบบทะเบียนไม่สำเร็จ", {
              attempts: attempt,
              cause,
            });
      }

      if (!error.retryable || attempt > this.maxRetries) throw error;
      await this.sleep(this.retryDelayMs * 2 ** (attempt - 1));
    }
  }
}
