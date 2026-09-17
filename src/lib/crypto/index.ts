import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

// PDPA ข้อ 4.5 — ค้นหาด้วย HMAC hash, เก็บค่าจริงด้วย AES-256-GCM, แสดงผลแบบ mask เสมอ

const CIPHER_VERSION = "v1";

function getPepper(): string {
  const pepper = process.env.IDENTIFIER_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("IDENTIFIER_PEPPER ต้องตั้งค่าอย่างน้อย 32 ตัวอักษร");
  }
  return pepper;
}

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY ต้องเป็น hex 64 ตัวอักษร (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function normalizeIdentifier(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function hashIdentifier(value: string): string {
  return createHmac("sha256", getPepper()).update(normalizeIdentifier(value)).digest("hex");
}

// HMAC ของข้อความทั้งก้อน (ไม่ normalize) — ใช้ตรวจว่าข้อมูลต้นทางเปลี่ยนหรือไม่ โดยไม่เก็บเนื้อหา
export function keyedDigest(value: string): string {
  return createHmac("sha256", getPepper()).update(value).digest("hex");
}

export function encrypt(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [CIPHER_VERSION, iv, tag, cipherText]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(":");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, cipherText] = payload.split(":");
  if (version !== CIPHER_VERSION || !iv || !tag || !cipherText) {
    throw new Error("รูปแบบข้อมูลเข้ารหัสไม่ถูกต้อง");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

// 1234567890123 → 1-2345-xxxxx-xx-3
export function maskCitizenId(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 13) return "x-xxxx-xxxxx-xx-x";
  return `${digits[0]}-${digits.slice(1, 5)}-xxxxx-xx-${digits[12]}`;
}

// AB1234567 → ABxxxxx67
export function maskPassportNo(value: string): string {
  const normalized = normalizeIdentifier(value);
  if (normalized.length < 5) return "x".repeat(normalized.length);
  return `${normalized.slice(0, 2)}${"x".repeat(normalized.length - 4)}${normalized.slice(-2)}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// token สุ่มสำหรับลิงก์ในอีเมล — ส่งค่า token ให้ผู้ใช้ เก็บเฉพาะ tokenHash ในฐานข้อมูล
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}
