// รหัสข้อผิดพลาดกลางของการเชื่อมต่อระบบทะเบียน — หน้า /staff/sync แปลรหัสนี้เป็นข้อความสองภาษา

export const REGISTRY_ERROR_CODES = [
  "TIMEOUT",
  "NETWORK",
  "UNAUTHORIZED",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "BAD_RESPONSE",
  "UNAVAILABLE",
] as const;

export type RegistryErrorCode = (typeof REGISTRY_ERROR_CODES)[number];

const RETRYABLE: ReadonlySet<RegistryErrorCode> = new Set([
  "TIMEOUT",
  "NETWORK",
  "RATE_LIMITED",
  "SERVER_ERROR",
]);

export class RegistryError extends Error {
  readonly code: RegistryErrorCode;
  readonly status: number | null;
  readonly attempts: number;

  constructor(
    code: RegistryErrorCode,
    message: string,
    options: { status?: number | null; attempts?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "RegistryError";
    this.code = code;
    this.status = options.status ?? null;
    this.attempts = options.attempts ?? 1;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }
}

export function isRegistryErrorCode(value: unknown): value is RegistryErrorCode {
  return REGISTRY_ERROR_CODES.includes(value as RegistryErrorCode);
}
