import "server-only";
import { HttpRegistryClient } from "./http-client";
import { KeystoneRegistryClient } from "./keystone-client";
import { MockRegistryClient } from "./mock-client";
import type { RegistryClient } from "./types";

// factory เลือก client ตาม env REGISTRY_CLIENT (mock | http | keystone)

export function isMockRegistryEnabled(): boolean {
  return process.env.MOCK_REGISTRY_ENABLED === "true";
}

// healthCheck = ตรวจสถานะบนหน้าเว็บ ต้องตอบเร็ว จึงไม่ retry และ timeout สั้น
export function getRegistryClient({ healthCheck = false } = {}): RegistryClient {
  const kind = process.env.REGISTRY_CLIENT ?? "mock";

  if (kind === "http") {
    const baseUrl = process.env.REGISTRY_API_URL;
    if (!baseUrl) throw new Error("REGISTRY_CLIENT=http ต้องตั้งค่า REGISTRY_API_URL");
    const timeoutMs = Number(process.env.REGISTRY_TIMEOUT_MS ?? 10_000);
    return new HttpRegistryClient({
      baseUrl,
      apiKey: process.env.REGISTRY_API_KEY,
      timeoutMs: healthCheck ? Math.min(timeoutMs, 3_000) : timeoutMs,
      maxRetries: healthCheck ? 0 : 3,
    });
  }

  if (kind === "keystone") {
    const baseUrl = process.env.REGISTRY_API_URL;
    if (!baseUrl) throw new Error("REGISTRY_CLIENT=keystone ต้องตั้งค่า REGISTRY_API_URL");
    const timeoutMs = Number(process.env.REGISTRY_TIMEOUT_MS ?? 60_000);
    return new KeystoneRegistryClient({
      baseUrl,
      apiKey: process.env.REGISTRY_API_KEY,
      timeoutMs: healthCheck ? Math.min(timeoutMs, 5_000) : timeoutMs,
      maxRetries: healthCheck ? 0 : 3,
      batchRange: process.env.KEYSTONE_BATCH_RANGE,
    });
  }

  if (kind === "mock") {
    return new MockRegistryClient({ enabled: isMockRegistryEnabled() });
  }

  throw new Error(`REGISTRY_CLIENT ไม่รองรับค่า "${kind}" (ใช้ mock, http หรือ keystone)`);
}

export { RegistryError } from "./errors";
export type { RegistryErrorCode } from "./errors";
export type { RegistryClient, RegistryStudent, SyncStudent } from "./types";
