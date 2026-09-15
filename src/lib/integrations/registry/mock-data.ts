import type { ListStudentsParams, RegistryStudent } from "./types";

// ข้อมูลสมมติของ Mock Registry (F-DATA-04) — สร้างแบบ deterministic ได้ชุดเดิมทุกครั้ง
// ประกอบด้วยเคสทดสอบที่ตั้งใจ (MOCK_TEST_CASES) + ระเบียนสุ่มให้ครบ MOCK_STUDENT_COUNT ราย

export const MOCK_STUDENT_COUNT = 240;

type Level = RegistryStudent["educationLevel"];

export function withCheckDigit(base12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base12[i]) * (13 - i);
  return `${base12}${(11 - (sum % 11)) % 10}`;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Program = {
  level: Level;
  degreeTh: string;
  degreeEn: string;
  majors: readonly (readonly [string, string] | null)[];
};

type Faculty = { code: string; th: string; en: string; programs: readonly Program[] };

const FACULTIES: readonly Faculty[] = [
  {
    code: "10",
    th: "คณะบริหารธุรกิจ",
    en: "Faculty of Business Administration",
    programs: [
      {
        level: "BACHELOR",
        degreeTh: "บริหารธุรกิจบัณฑิต",
        degreeEn: "Bachelor of Business Administration",
        majors: [
          ["การตลาด", "Marketing"],
          ["การจัดการ", "Management"],
          ["การบัญชี", "Accounting"],
        ],
      },
      {
        level: "MASTER",
        degreeTh: "บริหารธุรกิจมหาบัณฑิต",
        degreeEn: "Master of Business Administration",
        majors: [null],
      },
    ],
  },
  {
    code: "20",
    th: "คณะนิติศาสตร์",
    en: "Faculty of Law",
    programs: [
      {
        level: "BACHELOR",
        degreeTh: "นิติศาสตรบัณฑิต",
        degreeEn: "Bachelor of Laws",
        majors: [null],
      },
      {
        level: "MASTER",
        degreeTh: "นิติศาสตรมหาบัณฑิต",
        degreeEn: "Master of Laws",
        majors: [null],
      },
    ],
  },
  {
    code: "30",
    th: "คณะรัฐศาสตร์",
    en: "Faculty of Political Science",
    programs: [
      {
        level: "BACHELOR",
        degreeTh: "รัฐศาสตรบัณฑิต",
        degreeEn: "Bachelor of Political Science",
        majors: [
          ["การเมืองการปกครอง", "Politics and Government"],
          ["รัฐประศาสนศาสตร์", "Public Administration"],
        ],
      },
      {
        level: "MASTER",
        degreeTh: "รัฐศาสตรมหาบัณฑิต",
        degreeEn: "Master of Political Science",
        majors: [null],
      },
      {
        level: "DOCTORAL",
        degreeTh: "รัฐศาสตรดุษฎีบัณฑิต",
        degreeEn: "Doctor of Philosophy in Political Science",
        majors: [null],
      },
    ],
  },
  {
    code: "40",
    th: "คณะนิเทศศาสตร์",
    en: "Faculty of Communication Arts",
    programs: [
      {
        level: "BACHELOR",
        degreeTh: "นิเทศศาสตรบัณฑิต",
        degreeEn: "Bachelor of Communication Arts",
        majors: [
          ["วิทยุกระจายเสียงและวิทยุโทรทัศน์", "Broadcasting"],
          ["การประชาสัมพันธ์", "Public Relations"],
        ],
      },
    ],
  },
  {
    code: "50",
    th: "คณะศิลปศาสตร์",
    en: "Faculty of Liberal Arts",
    programs: [
      {
        level: "BACHELOR",
        degreeTh: "ศิลปศาสตรบัณฑิต",
        degreeEn: "Bachelor of Arts",
        majors: [
          ["ภาษาอังกฤษ", "English"],
          ["ภาษาจีน", "Chinese"],
        ],
      },
    ],
  },
  {
    code: "60",
    th: "คณะวิศวกรรมศาสตร์",
    en: "Faculty of Engineering",
    programs: [
      {
        level: "BACHELOR",
        degreeTh: "วิศวกรรมศาสตรบัณฑิต",
        degreeEn: "Bachelor of Engineering",
        majors: [
          ["วิศวกรรมคอมพิวเตอร์", "Computer Engineering"],
          ["วิศวกรรมไฟฟ้า", "Electrical Engineering"],
        ],
      },
    ],
  },
];

type NamePair = readonly [th: string, en: string];

const MALE_FIRST: readonly NamePair[] = [
  ["สมชาย", "Somchai"],
  ["ธนากร", "Thanakorn"],
  ["ภานุวัฒน์", "Panuwat"],
  ["กิตติพงษ์", "Kittipong"],
  ["วรพล", "Worapon"],
  ["ณัฐวุฒิ", "Nattawut"],
  ["อนุชา", "Anucha"],
  ["ปิยะพงษ์", "Piyapong"],
  ["ศุภชัย", "Supachai"],
  ["เอกชัย", "Ekkachai"],
  ["จิรายุ", "Jirayu"],
  ["พีรพัฒน์", "Peerapat"],
];

const FEMALE_FIRST: readonly NamePair[] = [
  ["ศิริพร", "Siriporn"],
  ["กมลชนก", "Kamonchanok"],
  ["ณัฐพร", "Nattaporn"],
  ["พิมพ์ชนก", "Pimchanok"],
  ["สุภาวดี", "Supawadee"],
  ["อรอุมา", "Onuma"],
  ["ปวีณา", "Paweena"],
  ["ชนิดา", "Chanida"],
  ["วรรณา", "Wanna"],
  ["ธิดารัตน์", "Thidarat"],
  ["กัญญารัตน์", "Kanyarat"],
  ["มาลัย", "Malai"],
];

const LAST_NAMES: readonly NamePair[] = [
  ["ใจดี", "Jaidee"],
  ["วงศ์ใหญ่", "Wongyai"],
  ["สุขสวัสดิ์", "Suksawat"],
  ["ศรีทอง", "Srithong"],
  ["รัตนกุล", "Rattanakul"],
  ["แสงอรุณ", "Saengarun"],
  ["บุญมา", "Boonma"],
  ["ทองดี", "Thongdee"],
  ["พรหมมา", "Prommar"],
  ["เจริญสุข", "Charoensuk"],
  ["มั่นคง", "Mankong"],
  ["ศักดิ์สิทธิ์", "Saksit"],
  ["อินทร์แก้ว", "Inkaew"],
  ["ชัยมงคล", "Chaimongkol"],
  ["นาคสุข", "Naksuk"],
];

// ชาวต่างชาติ — ใช้หนังสือเดินทางแทนเลขบัตรประชาชน
const FOREIGNERS = [
  { male: true, th: ["หลี่", "เว่ย"], en: ["Li", "Wei"], passportPrefix: "E" },
  { male: false, th: ["เหงียน", "ถิ ลาน"], en: ["Nguyen", "Thi Lan"], passportPrefix: "C" },
  { male: true, th: ["อ่อง", "จอ"], en: ["Aung", "Kyaw"], passportPrefix: "MA" },
  { male: false, th: ["โสภา", "จันทร์"], en: ["Sophea", "Chan"], passportPrefix: "N" },
  { male: true, th: ["แดเนียล", "สมิธ"], en: ["Daniel", "Smith"], passportPrefix: "GB" },
  { male: false, th: ["ยูกิ", "ทานากะ"], en: ["Yuki", "Tanaka"], passportPrefix: "TK" },
] as const;

const FIXED_UPDATED_AT = "2026-06-01T02:00:00.000Z";

function programName(program: Program, major: readonly [string, string] | null) {
  return {
    degreeNameTh: program.degreeTh,
    degreeNameEn: program.degreeEn,
    programTh: major ? `${program.degreeTh} สาขาวิชา${major[0]}` : program.degreeTh,
    programEn: major ? `${program.degreeEn} Program in ${major[1]}` : `${program.degreeEn} Program`,
    majorTh: major?.[0] ?? null,
    majorEn: major?.[1] ?? null,
  };
}

function facultyProgram(facultyCode: string, level: Level, majorIndex = 0) {
  const faculty = FACULTIES.find((f) => f.code === facultyCode)!;
  const program = faculty.programs.find((p) => p.level === level)!;
  return {
    educationLevel: level,
    facultyTh: faculty.th,
    facultyEn: faculty.en,
    ...programName(program, program.majors[majorIndex] ?? null),
  };
}

function thaiPerson(male: boolean, first: NamePair, last: NamePair) {
  return {
    prefixTh: male ? "นาย" : "นางสาว",
    firstNameTh: first[0],
    lastNameTh: last[0],
    prefixEn: male ? "Mr." : "Ms.",
    firstNameEn: first[1],
    lastNameEn: last[1],
  };
}

function honorsFor(level: Level, status: RegistryStudent["status"], gpa: number | null) {
  if (level !== "BACHELOR" || status === "STUDYING" || status === "WITHDRAWN" || gpa === null) {
    return null;
  }
  if (gpa >= 3.6) return "FIRST_CLASS" as const;
  if (gpa >= 3.25) return "SECOND_CLASS" as const;
  return null;
}

export type MockTestCase = {
  label: string;
  studentCode: string;
  searchType: "CITIZEN_ID" | "PASSPORT";
  identifier: string;
  expected: string;
};

type FixedCase = RegistryStudent & { label: string; expected: string };

function fixed(
  label: string,
  expected: string,
  data: Omit<RegistryStudent, "updatedAt" | "requiresManualReview" | "honors"> &
    Partial<Pick<RegistryStudent, "requiresManualReview" | "honors">>,
): FixedCase {
  return {
    label,
    expected,
    honors: data.honors ?? honorsFor(data.educationLevel, data.status, data.gpa),
    requiresManualReview: data.requiresManualReview ?? false,
    updatedAt: FIXED_UPDATED_AT,
    ...data,
  };
}

const SAME_PERSON_CITIZEN_ID = withCheckDigit("110090045678");

// เคสที่ตั้งใจสร้างเพื่อทดสอบกฎ auto-approve (spec ข้อ 4.2) — รหัสคณะ "12" ไม่ชนกับระเบียนสุ่ม
const FIXED_CASES: readonly FixedCase[] = [
  fixed("จบปกติ + เกียรตินิยมอันดับ 1 (บัญชีศิษย์เก่าทดสอบ)", "AUTO", {
    studentCode: "6012345678",
    citizenId: withCheckDigit("110170023070"),
    passportNo: null,
    ...thaiPerson(false, ["ศิริพร", "Siriporn"], ["ใจดี", "Jaidee"]),
    ...facultyProgram("10", "BACHELOR", 0),
    gpa: 3.87,
    status: "GRADUATED",
    graduationDate: "2022-05-31",
    councilApprovalDate: "2022-06-28",
  }),
  fixed("จบปกติ ไม่มีเกียรตินิยม (ใช้ทดลองลงทะเบียนศิษย์เก่า)", "AUTO", {
    studentCode: "6112345679",
    citizenId: withCheckDigit("310150045120"),
    passportNo: null,
    ...thaiPerson(true, ["ธนากร", "Thanakorn"], ["วงศ์ใหญ่", "Wongyai"]),
    ...facultyProgram("20", "BACHELOR"),
    gpa: 3.12,
    status: "GRADUATED",
    graduationDate: "2023-05-30",
    councilApprovalDate: "2023-06-27",
  }),
  fixed("กำลังศึกษา", "PENDING_REVIEW", {
    studentCode: "6512345670",
    citizenId: withCheckDigit("150990012345"),
    passportNo: null,
    ...thaiPerson(false, ["กมลชนก", "Kamonchanok"], ["สุขสวัสดิ์", "Suksawat"]),
    ...facultyProgram("30", "BACHELOR", 0),
    gpa: 3.44,
    status: "STUDYING",
    graduationDate: null,
    councilApprovalDate: null,
  }),
  fixed("ถูกเพิกถอนวุฒิ", "PENDING_REVIEW", {
    studentCode: "5812345671",
    citizenId: withCheckDigit("110340056781"),
    passportNo: null,
    ...thaiPerson(true, ["ภานุวัฒน์", "Panuwat"], ["แสงอรุณ", "Saengarun"]),
    ...facultyProgram("40", "BACHELOR", 1),
    gpa: 2.95,
    status: "REVOKED",
    graduationDate: "2019-05-28",
    councilApprovalDate: "2019-06-25",
    requiresManualReview: true,
  }),
  fixed("ลาออก/พ้นสภาพ", "PENDING_REVIEW", {
    studentCode: "6212345672",
    citizenId: withCheckDigit("140120034567"),
    passportNo: null,
    ...thaiPerson(false, ["อรอุมา", "Onuma"], ["บุญมา", "Boonma"]),
    ...facultyProgram("50", "BACHELOR", 0),
    gpa: 1.85,
    status: "WITHDRAWN",
    graduationDate: null,
    councilApprovalDate: null,
  }),
  fixed("ชื่อซ้ำ คนที่ 1 (สมชาย ใจดี)", "AUTO", {
    studentCode: "5912345673",
    citizenId: withCheckDigit("310100123456"),
    passportNo: null,
    ...thaiPerson(true, ["สมชาย", "Somchai"], ["ใจดี", "Jaidee"]),
    ...facultyProgram("10", "BACHELOR", 1),
    gpa: 2.78,
    status: "GRADUATED",
    graduationDate: "2020-05-26",
    councilApprovalDate: "2020-06-30",
  }),
  fixed("ชื่อซ้ำ คนที่ 2 (สมชาย ใจดี) — คนละเลขบัตร", "AUTO", {
    studentCode: "6012345674",
    citizenId: withCheckDigit("350060078912"),
    passportNo: null,
    ...thaiPerson(true, ["สมชาย", "Somchai"], ["ใจดี", "Jaidee"]),
    ...facultyProgram("60", "BACHELOR", 0),
    gpa: 3.3,
    status: "GRADUATED",
    graduationDate: "2021-05-25",
    councilApprovalDate: "2021-06-29",
  }),
  fixed("คนเดียวหลายวุฒิ — ป.ตรี (เลขบัตรเดียวกับ ป.โท)", "PENDING_REVIEW", {
    studentCode: "5712345675",
    citizenId: SAME_PERSON_CITIZEN_ID,
    passportNo: null,
    ...thaiPerson(false, ["ปวีณา", "Paweena"], ["ทองดี", "Thongdee"]),
    ...facultyProgram("50", "BACHELOR", 0),
    gpa: 3.41,
    status: "GRADUATED",
    graduationDate: "2018-05-29",
    councilApprovalDate: "2018-06-26",
  }),
  fixed("คนเดียวหลายวุฒิ — ป.โท (เลขบัตรเดียวกับ ป.ตรี)", "PENDING_REVIEW", {
    studentCode: "6312345676",
    citizenId: SAME_PERSON_CITIZEN_ID,
    passportNo: null,
    ...thaiPerson(false, ["ปวีณา", "Paweena"], ["ทองดี", "Thongdee"]),
    ...facultyProgram("10", "MASTER"),
    gpa: 3.72,
    status: "GRADUATED",
    graduationDate: "2022-11-29",
    councilApprovalDate: "2022-12-27",
  }),
  fixed("ชาวต่างชาติใช้พาสปอร์ต — จบปกติ", "AUTO", {
    studentCode: "6212345677",
    citizenId: null,
    passportNo: "E12345678",
    prefixTh: "นาย",
    firstNameTh: "หลี่",
    lastNameTh: "เว่ย",
    prefixEn: "Mr.",
    firstNameEn: "Li",
    lastNameEn: "Wei",
    ...facultyProgram("10", "BACHELOR", 1),
    gpa: 3.05,
    status: "GRADUATED",
    graduationDate: "2023-05-30",
    councilApprovalDate: "2023-06-27",
  }),
  fixed("ชาวต่างชาติใช้พาสปอร์ต — เกียรตินิยมอันดับ 2", "AUTO", {
    studentCode: "6312345682",
    citizenId: null,
    passportNo: "C1234567",
    prefixTh: "นางสาว",
    firstNameTh: "เหงียน",
    lastNameTh: "ถิ ลาน",
    prefixEn: "Ms.",
    firstNameEn: "Nguyen",
    lastNameEn: "Thi Lan",
    ...facultyProgram("50", "BACHELOR", 0),
    gpa: 3.38,
    status: "GRADUATED",
    graduationDate: "2024-05-28",
    councilApprovalDate: "2024-06-25",
  }),
  fixed("ข้อมูลเก่าก่อนระบบดิจิทัล (ไม่มีวันสภาอนุมัติ)", "PENDING_REVIEW", {
    studentCode: "4012345678",
    citizenId: withCheckDigit("310020011223"),
    passportNo: null,
    prefixTh: "นาง",
    firstNameTh: "มาลัย",
    lastNameTh: "ศรีทอง",
    prefixEn: "Mrs.",
    firstNameEn: "Malai",
    lastNameEn: "Srithong",
    ...facultyProgram("20", "BACHELOR"),
    gpa: null,
    status: "GRADUATED",
    graduationDate: "2001-05-20",
    councilApprovalDate: null,
    requiresManualReview: true,
  }),
  fixed("จบแล้วแต่สภายังไม่อนุมัติ", "PENDING_REVIEW", {
    studentCode: "6412345679",
    citizenId: withCheckDigit("110250067890"),
    passportNo: null,
    ...thaiPerson(false, ["ชนิดา", "Chanida"], ["เจริญสุข", "Charoensuk"]),
    ...facultyProgram("30", "BACHELOR", 1),
    gpa: 3.66,
    status: "GRADUATED",
    graduationDate: "2026-05-28",
    councilApprovalDate: null,
  }),
  fixed("มีข้อพิพาท (ตั้งค่า requiresManualReview)", "PENDING_REVIEW", {
    studentCode: "6012345680",
    citizenId: withCheckDigit("170080034561"),
    passportNo: null,
    ...thaiPerson(true, ["กิตติพงษ์", "Kittipong"], ["มั่นคง", "Mankong"]),
    ...facultyProgram("40", "BACHELOR", 0),
    gpa: 2.64,
    status: "GRADUATED",
    graduationDate: "2021-05-25",
    councilApprovalDate: "2021-06-29",
    requiresManualReview: true,
  }),
  fixed("ปริญญาเอก", "AUTO", {
    studentCode: "6112345681",
    citizenId: withCheckDigit("120110098765"),
    passportNo: null,
    ...thaiPerson(true, ["ศุภชัย", "Supachai"], ["ชัยมงคล", "Chaimongkol"]),
    ...facultyProgram("30", "DOCTORAL"),
    gpa: 3.91,
    status: "GRADUATED",
    graduationDate: "2024-11-26",
    councilApprovalDate: "2024-12-24",
  }),
];

export const MOCK_TEST_CASES: readonly MockTestCase[] = FIXED_CASES.map((c) => ({
  label: c.label,
  studentCode: c.studentCode,
  searchType: c.citizenId ? "CITIZEN_ID" : "PASSPORT",
  identifier: (c.citizenId ?? c.passportNo)!,
  expected: c.expected,
}));

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function randomRecord(
  rand: () => number,
  index: number,
  usedCodes: Set<string>,
  usedIds: Set<string>,
  now: Date,
): RegistryStudent {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const between = (min: number, max: number) => min + rand() * (max - min);

  const statusRoll = rand();
  const status: RegistryStudent["status"] =
    statusRoll < 0.78
      ? "GRADUATED"
      : statusRoll < 0.9
        ? "STUDYING"
        : statusRoll < 0.97
          ? "WITHDRAWN"
          : "REVOKED";

  const faculty = pick(FACULTIES);
  const levelRoll = rand();
  const wantedLevel: Level =
    levelRoll < 0.8 ? "BACHELOR" : levelRoll < 0.95 ? "MASTER" : "DOCTORAL";
  const program = faculty.programs.find((p) => p.level === wantedLevel) ?? faculty.programs[0]!;
  const major = pick(program.majors);
  const years = program.level === "BACHELOR" ? 4 : program.level === "MASTER" ? 2 : 3;

  const entryBE =
    status === "STUDYING"
      ? 2565 + Math.floor(rand() * 4)
      : status === "WITHDRAWN"
        ? 2558 + Math.floor(rand() * 9)
        : 2550 + Math.floor(rand() * 15);

  let studentCode: string;
  let seq = 100000 + index;
  do {
    studentCode = `${entryBE % 100}${faculty.code}${pad(seq++, 6)}`;
  } while (usedCodes.has(studentCode));
  usedCodes.add(studentCode);

  const foreignRoll = rand();
  const isForeign = foreignRoll < 0.06;
  const hasBoth = !isForeign && foreignRoll < 0.09;

  let citizenId: string | null = null;
  if (!isForeign) {
    do {
      const base = `${1 + Math.floor(rand() * 8)}${Array.from({ length: 11 }, () => Math.floor(rand() * 10)).join("")}`;
      citizenId = withCheckDigit(base);
    } while (usedIds.has(citizenId));
    usedIds.add(citizenId);
  }

  const foreigner = isForeign ? pick(FOREIGNERS) : null;
  const passportNo =
    isForeign || hasBoth
      ? `${foreigner?.passportPrefix ?? "AA"}${pad(Math.floor(rand() * 10_000_000), 7)}`.slice(0, 9)
      : null;

  const male = foreigner ? foreigner.male : rand() < 0.5;
  const person = foreigner
    ? {
        prefixTh: male ? "นาย" : "นางสาว",
        firstNameTh: foreigner.th[0],
        lastNameTh: foreigner.th[1],
        prefixEn: male ? "Mr." : "Ms.",
        firstNameEn: foreigner.en[0],
        lastNameEn: foreigner.en[1],
      }
    : thaiPerson(male, pick(male ? MALE_FIRST : FEMALE_FIRST), pick(LAST_NAMES));

  const gpaRaw =
    status === "GRADUATED" || status === "REVOKED"
      ? between(2, 3.95)
      : status === "STUDYING"
        ? between(1.8, 3.9)
        : between(1.2, 2.5);
  const gpa = Math.round(gpaRaw * 100) / 100;

  let graduationDate: string | null = null;
  let councilApprovalDate: string | null = null;
  if (status === "GRADUATED" || status === "REVOKED") {
    const gradYear = entryBE - 543 + years;
    const graduated = new Date(
      Date.UTC(gradYear, 2 + Math.floor(rand() * 4), 1 + Math.floor(rand() * 28)),
    );
    const council = new Date(graduated.getTime() + (20 + Math.floor(rand() * 21)) * 86_400_000);
    graduationDate = isoDay(graduated);
    councilApprovalDate = isoDay(council);
  }

  const disputed = status === "GRADUATED" && rand() < 0.02;

  const baseUpdated = Date.UTC(2026, 0, 1) + Math.floor(rand() * 240) * 86_400_000;
  // ทุก ๆ 40 ระเบียน จำลองว่ามีการแก้ไขในวันนี้ เพื่อให้ incremental sync มีข้อมูลให้ดึง
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const updatedAt = new Date(
    index % 40 === 7 ? startOfToday : Math.min(baseUpdated, startOfToday),
  ).toISOString();

  return {
    studentCode,
    citizenId,
    passportNo,
    ...person,
    educationLevel: program.level,
    facultyTh: faculty.th,
    facultyEn: faculty.en,
    ...programName(program, major),
    gpa,
    honors: honorsFor(program.level, status, gpa),
    status,
    graduationDate,
    councilApprovalDate,
    requiresManualReview: status === "REVOKED" || disputed,
    updatedAt,
  };
}

export function generateMockStudents(now: Date = new Date()): RegistryStudent[] {
  const rand = mulberry32(2569);
  const students: RegistryStudent[] = FIXED_CASES.map(({ label: _l, expected: _e, ...s }) => s);
  const usedCodes = new Set(students.map((s) => s.studentCode));
  const usedIds = new Set(students.flatMap((s) => (s.citizenId ? [s.citizenId] : [])));

  for (let i = 0; students.length < MOCK_STUDENT_COUNT; i++) {
    students.push(randomRecord(rand, i, usedCodes, usedIds, now));
  }
  return students.sort((a, b) => a.studentCode.localeCompare(b.studentCode));
}

export function queryMockStudents(
  students: readonly RegistryStudent[],
  params: ListStudentsParams,
) {
  const since = params.updatedSince?.getTime();
  const filtered =
    since === undefined ? students : students.filter((s) => Date.parse(s.updatedAt) > since);
  const start = (params.page - 1) * params.pageSize;
  const items = filtered.slice(start, start + params.pageSize);
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total: filtered.length,
    hasMore: start + items.length < filtered.length,
  };
}
