import type { z } from "zod";

// ผลลัพธ์กลางของ Server Action — error / fieldErrors เป็น key ของ next-intl ให้ฝั่ง client แปล
// (แยกจากไฟล์ "use server" เพราะไฟล์นั้น export ได้เฉพาะ async function)

export type ActionState = {
  ok: boolean;
  error?: string;
  errorValues?: Record<string, string | number>;
  fieldErrors?: Record<string, string>;
  message?: string;
  messageValues?: Record<string, string | number>;
};

export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
