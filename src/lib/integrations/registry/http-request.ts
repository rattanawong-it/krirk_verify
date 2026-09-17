import { RegistryError, type RegistryErrorCode } from "./errors";

// F-DATA-05: เรียก HTTP ของระบบทะเบียน — timeout + retry แบบ exponential backoff + แปลง error เป็นรหัสกลาง
// ใช้ร่วมกันระหว่าง client ตามสัญญาเดิม (http-client.ts) และ Keystone (keystone-client.ts)

export type HttpRequestOptions = {
  headers: Record<string, string>;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  // status ที่ไม่ใช่ 2xx แต่ผู้เรียกจะอ่าน body เอง (เช่น 404 = ไม่พบ, 400 ของ Keystone มีรหัสใน envelope)
  accept?: (status: number) => boolean;
};

export const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function codeForStatus(status: number): RegistryErrorCode {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "BAD_RESPONSE";
}

export async function requestJson(
  url: string,
  options: HttpRequestOptions,
): Promise<{ status: number; body: unknown }> {
  for (let attempt = 1; ; attempt++) {
    let error: RegistryError;
    try {
      const response = await options.fetch(url, {
        headers: options.headers,
        signal: AbortSignal.timeout(options.timeoutMs),
      });

      if (!response.ok && options.accept?.(response.status)) {
        // body ของ status ที่ยอมรับอาจไม่ใช่ JSON (เช่น 404 จาก reverse proxy)
        return { status: response.status, body: await response.json().catch(() => null) };
      }
      if (response.ok) {
        try {
          return { status: response.status, body: await response.json() };
        } catch (cause) {
          throw new RegistryError("BAD_RESPONSE", "response ไม่ใช่ JSON", {
            status: response.status,
            attempts: attempt,
            cause,
          });
        }
      }

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
        ? new RegistryError("TIMEOUT", `ระบบทะเบียนไม่ตอบกลับภายใน ${options.timeoutMs} ms`, {
            attempts: attempt,
            cause,
          })
        : new RegistryError("NETWORK", "เชื่อมต่อระบบทะเบียนไม่สำเร็จ", {
            attempts: attempt,
            cause,
          });
    }

    if (!error.retryable || attempt > options.maxRetries) throw error;
    await options.sleep(options.retryDelayMs * 2 ** (attempt - 1));
  }
}
