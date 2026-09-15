import { describe, expect, it } from "vitest";
import { type AppRole, ROLES, decideAccess, getRouteAccess, homePathFor } from "@/lib/auth/rbac";

const decide = (path: string, role: AppRole | null) => decideAccess(getRouteAccess(path), role);

describe("RBAC — ผู้ที่ยังไม่เข้าสู่ระบบ", () => {
  it("เข้าหน้าสาธารณะและหน้า guest ได้", () => {
    expect(decide("/", null)).toBe("allow");
    expect(decide("/login", null)).toBe("allow");
    expect(decide("/register/alumni", null)).toBe("allow");
    expect(decide("/verify-email", null)).toBe("allow");
    expect(decide("/reset-password", null)).toBe("allow");
  });

  it("ถูกส่งไปหน้าเข้าสู่ระบบเมื่อเปิดหน้าที่ต้องล็อกอิน", () => {
    for (const path of [
      "/dashboard",
      "/requests/new",
      "/batch",
      "/profile",
      "/staff/queue",
      "/staff/users",
    ]) {
      expect(decide(path, null)).toBe("login");
    }
  });
});

describe("RBAC — ปฏิเสธทุกบทบาทที่ไม่มีสิทธิ์", () => {
  const cases: { path: string; allowed: AppRole[] }[] = [
    { path: "/staff/dashboard", allowed: ["ADMIN", "REGISTRAR"] },
    { path: "/staff/queue/KRU-2569-000123", allowed: ["ADMIN", "REGISTRAR"] },
    { path: "/staff/users", allowed: ["ADMIN"] },
    { path: "/staff/audit-logs", allowed: ["ADMIN"] },
    { path: "/staff/settings", allowed: ["ADMIN"] },
    { path: "/dashboard", allowed: ["EXTERNAL", "ALUMNI"] },
    { path: "/requests/new", allowed: ["EXTERNAL", "ALUMNI"] },
    { path: "/batch", allowed: ["EXTERNAL"] },
    { path: "/profile", allowed: ["ADMIN", "REGISTRAR", "EXTERNAL", "ALUMNI"] },
  ];

  for (const { path, allowed } of cases) {
    for (const role of ROLES) {
      const expected = allowed.includes(role) ? "allow" : "forbidden";
      it(`${role} → ${path} = ${expected}`, () => {
        expect(decide(path, role)).toBe(expected);
      });
    }
  }
});

describe("RBAC — ตัวช่วยอื่น", () => {
  it("ผู้ที่ล็อกอินแล้วเปิดหน้า guest จะถูกส่งกลับหน้าหลัก", () => {
    expect(decide("/login", "EXTERNAL")).toBe("home");
  });

  it("ไม่จับคู่ prefix แบบครึ่งคำ", () => {
    expect(getRouteAccess("/staffing")).toEqual({ kind: "public" });
    expect(getRouteAccess("/dashboards")).toEqual({ kind: "public" });
  });

  it("หน้าหลักตามบทบาท", () => {
    expect(homePathFor("ADMIN")).toBe("/staff/dashboard");
    expect(homePathFor("REGISTRAR")).toBe("/staff/dashboard");
    expect(homePathFor("EXTERNAL")).toBe("/dashboard");
    expect(homePathFor("ALUMNI")).toBe("/dashboard");
  });
});
