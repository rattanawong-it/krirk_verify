import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  maskIp,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "@/lib/email/templates";

describe("email templates", () => {
  it("escapeHtml กันการแทรก HTML", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("maskIp ปิดบังสองส่วนท้ายของ IPv4", () => {
    expect(maskIp("203.150.12.34")).toBe("203.150.xx.xx");
    expect(maskIp(null)).toBe("-");
  });

  it("อีเมลยืนยัน (ไทย) มีลิงก์ และ escape ชื่อหน่วยงาน", () => {
    const url = "http://localhost:3000/verify-email?token=abc_123";
    const mail = verifyEmailTemplate({
      locale: "th",
      kind: "organization",
      orgName: "<b>บริษัท ทดสอบ</b>",
      url,
    });
    expect(mail.subject).toBe("ยืนยันอีเมลสำหรับระบบ Krirk Verify");
    expect(mail.html).toContain(url);
    expect(mail.html).toContain("&lt;b&gt;บริษัท ทดสอบ&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>บริษัท");
    expect(mail.text).toContain(url);
  });

  it("อีเมลรีเซ็ตรหัสผ่าน (อังกฤษ) แสดง IP แบบ mask", () => {
    const mail = resetPasswordTemplate({
      locale: "en",
      url: "http://localhost:3000/en/reset-password?token=xyz",
      ipAddress: "203.150.12.34",
      requestedAt: new Date("2026-09-12T02:12:00Z"),
    });
    expect(mail.subject).toBe("Reset your Krirk Verify password");
    expect(mail.html).toContain("203.150.xx.xx");
    expect(mail.html).not.toContain("203.150.12.34");
  });
});
