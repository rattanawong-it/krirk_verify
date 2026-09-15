import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// ค่าทดสอบเท่านั้น — ไม่ใช้กับข้อมูลจริง
process.env.IDENTIFIER_PEPPER ??= "test-pepper-0123456789abcdef0123456789abcdef";
process.env.ENCRYPTION_KEY ??= "0".repeat(63) + "1";

afterEach(() => {
  cleanup();
});
