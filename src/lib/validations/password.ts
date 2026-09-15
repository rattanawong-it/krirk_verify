// นโยบายรหัสผ่าน (F-AUTH-10): อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข
// จำกัด 72 bytes เพราะ bcrypt ตัดส่วนเกินทิ้งเงียบ ๆ
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export type PasswordIssue = "tooShort" | "tooLong" | "needLetter" | "needNumber" | "sameAsEmail";

export function checkPasswordPolicy(password: string, email?: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push("tooShort");
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) issues.push("tooLong");
  if (!/[A-Za-z]/.test(password)) issues.push("needLetter");
  if (!/\d/.test(password)) issues.push("needNumber");
  if (email && password.toLowerCase() === email.trim().toLowerCase()) issues.push("sameAsEmail");
  return issues;
}
