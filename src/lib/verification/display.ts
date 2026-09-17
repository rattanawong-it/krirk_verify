// การแสดงชื่อ/วุฒิจาก snapshot ผลตรวจสอบ — ใช้ร่วมกันทั้งหน้าเว็บและอีเมล

type NameFields = {
  prefixTh: string | null;
  firstNameTh: string;
  lastNameTh: string;
  prefixEn: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
};

type DegreeFields = {
  degreeNameTh: string;
  degreeNameEn: string | null;
  majorTh: string | null;
  majorEn: string | null;
};

// คำนำหน้าภาษาไทยติดกับชื่อ: นางสาวศิริพร ใจดี
export function fullNameTh(n: NameFields): string {
  return `${n.prefixTh ?? ""}${n.firstNameTh} ${n.lastNameTh}`.trim();
}

export function fullNameEn(n: NameFields): string | null {
  if (!n.firstNameEn) return null;
  return [n.prefixEn, n.firstNameEn, n.lastNameEn].filter(Boolean).join(" ");
}

export function displayName(n: NameFields, locale: string): string {
  return locale === "en" ? (fullNameEn(n) ?? fullNameTh(n)) : fullNameTh(n);
}

// "2/2023" (ภาค/ปี ค.ศ. จาก Keystone) → "ภาคการศึกษาที่ 2/2566" · "Semester 2/2023"
export function graduationTermLabel(term: string | null, locale: string): string | null {
  const match = term?.match(/^([1-3])\/(\d{4})$/);
  if (!match) return null;
  return locale === "en"
    ? `Semester ${match[1]}/${match[2]}`
    : `ภาคการศึกษาที่ ${match[1]}/${Number(match[2]) + 543}`;
}

export function degreeLabel(d: DegreeFields, locale: string): string {
  const en = locale === "en" && d.degreeNameEn;
  const degree = en ? d.degreeNameEn! : d.degreeNameTh;
  const major = en ? (d.majorEn ?? d.majorTh) : d.majorTh;
  return major ? `${degree} (${major})` : degree;
}
