import { describe, expect, it } from "vitest";
import {
  buildFacultyOptions,
  facultyKey,
  sortFacultyOptions,
} from "@/lib/verification/faculty-options";

describe("buildFacultyOptions", () => {
  it("คณะเดียวกันที่มีทั้งชื่ออังกฤษแทนไทยและชื่อไทยจริง → แถวเดียว ใช้ชื่อไทยจริง", () => {
    const options = buildFacultyOptions([
      { facultyTh: "Business Administration", facultyEn: "Business Administration" },
      { facultyTh: "บริหารธุรกิจ", facultyEn: "Business Administration" },
      { facultyTh: "Laws", facultyEn: "Laws" },
    ]);
    expect(options).toEqual([
      {
        value: "Business Administration",
        labelTh: "บริหารธุรกิจ",
        labelEn: "Business Administration",
      },
      { value: "Laws", labelTh: "Laws", labelEn: "Laws" },
    ]);
  });

  it("ลำดับข้อมูลไม่มีผล · คณะที่ยังไม่รู้ชื่อไทยแสดงชื่ออังกฤษ", () => {
    const [option] = buildFacultyOptions([
      { facultyTh: "ศิลปศาสตร์", facultyEn: "Liberal Arts" },
      { facultyTh: "Liberal Arts", facultyEn: "Liberal Arts" },
    ]);
    expect(option).toMatchObject({ value: "Liberal Arts", labelTh: "ศิลปศาสตร์" });
  });

  it("ไม่มีชื่ออังกฤษ (ข้อมูลจำลอง) → ใช้ชื่อไทยเป็นค่า · ข้ามระเบียนที่ไม่มีคณะ", () => {
    expect(facultyKey({ facultyTh: "คณะนิติศาสตร์", facultyEn: null })).toBe("คณะนิติศาสตร์");
    expect(
      buildFacultyOptions([
        { facultyTh: "คณะนิติศาสตร์", facultyEn: null },
        { facultyTh: "", facultyEn: null },
      ]),
    ).toEqual([{ value: "คณะนิติศาสตร์", labelTh: "คณะนิติศาสตร์", labelEn: "คณะนิติศาสตร์" }]);
  });
});

describe("sortFacultyOptions", () => {
  it("เรียงตามชื่อในภาษาที่แสดง", () => {
    const options = buildFacultyOptions([
      { facultyTh: "นิติศาสตร์", facultyEn: "Laws" },
      { facultyTh: "บริหารธุรกิจ", facultyEn: "Business Administration" },
    ]);
    expect(sortFacultyOptions(options, "th").map((o) => o.labelTh)).toEqual([
      "นิติศาสตร์",
      "บริหารธุรกิจ",
    ]);
    expect(sortFacultyOptions(options, "en").map((o) => o.labelEn)).toEqual([
      "Business Administration",
      "Laws",
    ]);
  });
});
