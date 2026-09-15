import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "@/components/ui/icon";

describe("Icon", () => {
  it("ซ่อนจาก screen reader เมื่อไม่มี aria-label", () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("อ่านออกเสียงได้เมื่อมี aria-label และใช้ขนาดตามที่กำหนด", () => {
    const { container } = render(<Icon name="shieldCheck" size={24} aria-label="ตรวจสอบแล้ว" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("ตรวจสอบแล้ว");
    expect(svg?.getAttribute("width")).toBe("24");
  });
});
