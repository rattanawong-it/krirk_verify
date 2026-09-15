import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isNavItemActive, navItemsFor } from "@/components/layout/nav-config";
import { ROLES, decideAccess, getRouteAccess } from "@/lib/auth/rbac";

describe("nav-config สอดคล้องกับ RBAC", () => {
  it("ทุกเมนูเปิดได้เฉพาะบทบาทที่เห็นเมนูนั้น (เมนูกับ proxy ไม่ขัดกัน)", () => {
    for (const item of NAV_ITEMS) {
      for (const role of ROLES) {
        const decision = decideAccess(getRouteAccess(item.href), role);
        expect({ href: item.href, role, decision }).toEqual({
          href: item.href,
          role,
          decision: item.roles.includes(role) ? "allow" : "forbidden",
        });
      }
    }
  });

  it("ศิษย์เก่าไม่เห็นเมนูตรวจสอบแบบชุด และหน่วยงานไม่เห็นเมนูเจ้าหน้าที่", () => {
    expect(navItemsFor("ALUMNI").map((i) => i.href)).not.toContain("/batch");
    expect(navItemsFor("EXTERNAL").some((i) => i.href.startsWith("/staff"))).toBe(false);
    expect(navItemsFor("REGISTRAR").map((i) => i.href)).not.toContain("/staff/users");
    expect(navItemsFor("ADMIN").map((i) => i.href)).toContain("/staff/users");
  });
});

describe("isNavItemActive", () => {
  const requests = NAV_ITEMS.find((i) => i.href === "/requests")!;
  const newRequest = NAV_ITEMS.find((i) => i.href === "/requests/new")!;

  it("active ที่หน้าย่อยของเมนู", () => {
    expect(isNavItemActive(requests, "/requests/KRU-2569-000123")).toBe(true);
  });

  it("ไม่ active ซ้อนกับเมนูที่ลึกกว่า", () => {
    expect(isNavItemActive(requests, "/requests/new")).toBe(false);
    expect(isNavItemActive(newRequest, "/requests/new")).toBe(true);
  });
});
