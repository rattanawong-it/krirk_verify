import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { toStudentRow } from "../src/lib/integrations/registry/mapper";
import { MOCK_TEST_CASES, generateMockStudents } from "../src/lib/integrations/registry/mock-data";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const isProduction = process.env.NODE_ENV === "production";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Krirk2569";

const defaultSettings: Record<string, unknown> = {
  "verification.autoApproveEnabled": true,
  "retention.days": 1825,
  "announcement.th": "",
  "announcement.en": "",
};

async function seedSettings() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.appSetting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never },
    });
  }
}

// F-DATA-10: นำเข้าข้อมูล Mock Registry ชุดเดียวกับที่ sync ดึงได้ — ระเบียนที่มีอยู่แล้วไม่เขียนทับ
async function seedStudents() {
  const syncedAt = new Date();
  const students = generateMockStudents(syncedAt);
  for (const student of students) {
    await prisma.student.upsert({
      where: { studentCode: student.studentCode },
      update: {},
      create: toStudentRow(student, syncedAt),
    });
  }
  console.log(`✔ ข้อมูลผู้สำเร็จการศึกษา (Mock Registry) ${students.length} ระเบียน`);
}

async function seedDemoUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = new Date();
  const active = { status: "ACTIVE" as const, emailVerifiedAt: now, passwordHash };

  const approvedOrg = await prisma.organization.upsert({
    where: { taxId: "0105548000001" },
    update: {},
    create: {
      nameTh: "บริษัท ไทยเอชอาร์ โซลูชันส์ จำกัด",
      nameEn: "Thai HR Solutions Co., Ltd.",
      taxId: "0105548000001",
      orgType: "PRIVATE_COMPANY",
      address: "99 อาคารสาทรทาวเวอร์ ถนนสาทรใต้ แขวงยานนาวา เขตสาทร กรุงเทพฯ 10120",
      contactEmail: "hr@thaihr.co.th",
      phone: "02-111-2222",
      status: "APPROVED",
      approvedAt: now,
    },
  });

  const pendingOrg = await prisma.organization.upsert({
    where: { taxId: "0105560000002" },
    update: {},
    create: {
      nameTh: "บริษัท นิวคอร์ป จำกัด",
      nameEn: "Newcorp Co., Ltd.",
      taxId: "0105560000002",
      orgType: "PRIVATE_COMPANY",
      address: "1 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900",
      contactEmail: "pending@newcorp.co.th",
      phone: "02-333-4444",
    },
  });

  const alumniStudent = await prisma.student.findUniqueOrThrow({
    where: { studentCode: "6012345678" },
  });

  const users = [
    { email: "admin@krirk.ac.th", role: "ADMIN" as const, name: "ผู้ดูแลระบบ" },
    {
      email: "registrar@krirk.ac.th",
      role: "REGISTRAR" as const,
      name: "เจ้าหน้าที่ทะเบียน ทดสอบ",
    },
    {
      email: "hr@thaihr.co.th",
      role: "EXTERNAL" as const,
      name: "นางสาวณัฐพร สุขใจ",
      position: "ผู้จัดการฝ่ายบุคคล",
      organizationId: approvedOrg.id,
    },
    {
      email: "pending@newcorp.co.th",
      role: "EXTERNAL" as const,
      name: "นายสมชาย รอผล",
      organizationId: pendingOrg.id,
    },
    {
      email: "alumni@example.com",
      role: "ALUMNI" as const,
      name: "นางสาวศิริพร ใจดี",
      studentId: alumniStudent.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, ...active },
    });
  }

  console.log("✔ บัญชีทดสอบ (รหัสผ่าน: SEED_DEMO_PASSWORD หรือค่าเริ่มต้น)");
  console.table(users.map(({ email, role }) => ({ email, role })));
  console.log("✔ เคสทดสอบในข้อมูลสมมติ (ลงทะเบียนศิษย์เก่าได้ด้วย 6112345679 + เลขบัตรในตาราง):");
  console.table(
    MOCK_TEST_CASES.map((c) => ({
      case: c.label,
      studentCode: c.studentCode,
      identifier: c.identifier,
      expected: c.expected,
    })),
  );
}

async function main() {
  await seedSettings();
  console.log(`✔ ค่าตั้งต้นระบบ ${Object.keys(defaultSettings).length} รายการ`);

  if (isProduction) {
    console.log("ข้ามข้อมูลทดสอบ (NODE_ENV=production)");
    return;
  }
  await seedStudents();
  await seedDemoUsers();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
