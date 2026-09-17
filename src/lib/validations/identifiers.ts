export function stripIdentifier(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

// checksum เลขบัตรประชาชนไทย: หลักที่ 13 = (11 - (Σ หลักที่ i × (14 - i)) mod 11) mod 10
export function isValidThaiCitizenId(value: string): boolean {
  const digits = stripIdentifier(value);
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (13 - i);
  }
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

// หนังสือเดินทาง: ตัวอักษรภาษาอังกฤษ/ตัวเลข 6–9 ตัว
export function isValidPassportNo(value: string): boolean {
  return /^[A-Z0-9]{6,9}$/.test(stripIdentifier(value));
}

// 1234567890123 → 1-2345-67890-12-3
export function formatCitizenId(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 13);
  const parts = [d.slice(0, 1), d.slice(1, 5), d.slice(5, 10), d.slice(10, 12), d.slice(12, 13)];
  return parts.filter(Boolean).join("-");
}

// รหัสที่ผู้ใช้กรอก (ลงทะเบียนศิษย์เก่า) — Keystone ใช้ตัวเลข 8–12 หลัก (ข้อมูลจำลองเดิม 10 หลัก)
export function isValidStudentCode(value: string): boolean {
  return /^\d{8,12}$/.test(value.trim());
}

// รหัสที่ระบบทะเบียนส่งมาได้ (มีตัวอักษรปนในข้อมูลเก่าไม่กี่ระเบียน) — ใช้กับ URL/การกระทำของเจ้าหน้าที่
export function isRegistryStudentCode(value: string): boolean {
  return /^[A-Za-z0-9-]{1,30}$/.test(value);
}
