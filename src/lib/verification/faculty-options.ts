// ตัวเลือกคณะในหน้าข้อมูลผู้สำเร็จการศึกษา (pure function เพื่อ unit test ได้)
// Keystone ส่งชื่อคณะภาษาไทยเฉพาะผู้สำเร็จการศึกษา (StudentAcademicRecord) — ระเบียนอื่นมีแต่ชื่ออังกฤษ
// ถ้าจัดกลุ่มด้วยชื่อไทย คณะเดียวกันจะขึ้นสองแถว ("Business Administration" + "บริหารธุรกิจ")
// จึงใช้ชื่ออังกฤษเป็นคีย์ (ทุกระเบียนมี) และเลือกชื่อไทยที่รู้จักมาแสดง

export type FacultyNames = { facultyTh: string; facultyEn: string | null };
export type FacultyOption = { value: string; labelTh: string; labelEn: string };

const THAI_SCRIPT = /[฀-๿]/;

// ข้อมูลจำลอง/สัญญา HTTP เดิมอาจไม่มีชื่ออังกฤษ → ใช้ชื่อไทยเป็นคีย์
export function facultyKey({ facultyTh, facultyEn }: FacultyNames): string {
  return facultyEn ?? facultyTh;
}

export function buildFacultyOptions(names: readonly FacultyNames[]): FacultyOption[] {
  const byKey = new Map<string, FacultyOption>();
  for (const entry of names) {
    const value = facultyKey(entry);
    if (!value) continue;
    const option = byKey.get(value) ?? { value, labelTh: entry.facultyTh, labelEn: value };
    // ชื่อไทยจริงชนะชื่อที่ใช้ภาษาอังกฤษแทน
    if (THAI_SCRIPT.test(entry.facultyTh) && !THAI_SCRIPT.test(option.labelTh)) {
      option.labelTh = entry.facultyTh;
    }
    byKey.set(value, option);
  }
  return [...byKey.values()];
}

export function sortFacultyOptions(options: FacultyOption[], locale: string): FacultyOption[] {
  const label = (o: FacultyOption) => (locale === "en" ? o.labelEn : o.labelTh);
  return [...options].sort((a, b) =>
    label(a).localeCompare(label(b), locale === "en" ? "en" : "th"),
  );
}
