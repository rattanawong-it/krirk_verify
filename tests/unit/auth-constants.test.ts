import { describe, expect, it } from "vitest";
import { safeCallbackUrl, stripLocalePrefix } from "@/lib/auth/constants";

describe("safeCallbackUrl — กัน open redirect", () => {
  it("ยอมรับ path ภายใน", () => {
    expect(safeCallbackUrl("/staff/queue?status=PENDING_REVIEW")).toBe(
      "/staff/queue?status=PENDING_REVIEW",
    );
  });

  it("ปฏิเสธ URL ภายนอกและ protocol-relative", () => {
    expect(safeCallbackUrl("https://evil.example")).toBeNull();
    expect(safeCallbackUrl("//evil.example")).toBeNull();
    expect(safeCallbackUrl("/\\evil.example")).toBeNull();
    expect(safeCallbackUrl("javascript:alert(1)")).toBeNull();
    expect(safeCallbackUrl(undefined)).toBeNull();
    expect(safeCallbackUrl(["/a"])).toBeNull();
  });
});

describe("stripLocalePrefix", () => {
  it("ตัด prefix ภาษาออก", () => {
    expect(stripLocalePrefix("/en/staff/queue?x=1")).toBe("/staff/queue?x=1");
    expect(stripLocalePrefix("/th/login")).toBe("/login");
    expect(stripLocalePrefix("/en")).toBe("/");
    expect(stripLocalePrefix("/en?x=1")).toBe("/?x=1");
  });

  it("ไม่แตะ path ที่ไม่มี prefix หรือขึ้นต้นคล้ายกัน", () => {
    expect(stripLocalePrefix("/staff")).toBe("/staff");
    expect(stripLocalePrefix("/entry")).toBe("/entry");
  });
});
