import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummyHash: Promise<string> | undefined;

// เมื่อไม่พบอีเมล ยังคง compare กับ hash หลอก เพื่อไม่ให้เวลาตอบสนองบอกได้ว่าอีเมลมีอยู่จริง
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= bcrypt.hash("krirk-verify-dummy-password", BCRYPT_COST);
  await bcrypt.compare(password, await dummyHash);
  return false;
}
