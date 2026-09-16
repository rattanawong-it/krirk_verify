import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { checkPasswordPolicy } from "../src/lib/validations/password";

// F-OPS-06 — สร้างบัญชีผู้ดูแลระบบคนแรกบนเครื่อง production (seed ไม่สร้างบัญชีเมื่อ NODE_ENV=production)
// ใช้งาน:
//   pnpm admin:create --email admin@krirk.ac.th --name "ผู้ดูแลระบบ"
//   docker compose -f docker/docker-compose.prod.yml --env-file .env.prod run --rm migrate \
//     tsx prisma/create-admin.ts --email admin@krirk.ac.th --name "ผู้ดูแลระบบ"
// รหัสผ่าน: ตั้งผ่าน env ADMIN_PASSWORD หรือปล่อยว่างให้สุ่มและพิมพ์ออกมาครั้งเดียว — เปลี่ยนที่หน้าโปรไฟล์หลังล็อกอิน
// ทำงานได้เฉพาะเมื่อยังไม่มี ADMIN ที่ใช้งานอยู่ (เพิ่มผู้ดูแลคนต่อไปผ่านหน้า /staff/users) เว้นแต่ใส่ --force

const BCRYPT_COST = 12;

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function generatePassword(): string {
  // base64url 18 bytes = 24 ตัวอักษร · เติมตัวอักษร+ตัวเลขท้ายเพื่อให้ผ่านนโยบายรหัสผ่านเสมอ
  return `${randomBytes(18).toString("base64url")}a1`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string", default: "ผู้ดูแลระบบ" },
      force: { type: "boolean", default: false },
    },
  });

  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("ต้องระบุอีเมลที่ถูกต้อง เช่น --email admin@krirk.ac.th");
  }

  const provided = process.env.ADMIN_PASSWORD;
  const password = provided || generatePassword();
  const issues = checkPasswordPolicy(password, email);
  if (issues.length > 0) {
    fail(
      `ADMIN_PASSWORD ไม่ผ่านนโยบายรหัสผ่าน (${issues.join(", ")}) — อย่างน้อย 8 ตัว มีตัวอักษรและตัวเลข`,
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (activeAdmins > 0 && !values.force) {
      fail(
        `มีผู้ดูแลระบบที่ใช้งานอยู่แล้ว ${activeAdmins} บัญชี — เพิ่มผู้ดูแลผ่านหน้า /staff/users หรือใส่ --force`,
      );
    }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      fail(`อีเมล ${email} มีบัญชีอยู่แล้ว`);
    }

    const now = new Date();
    const user = await prisma.user.create({
      data: {
        email,
        name: values.name!,
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: now,
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "user.created",
        entityType: "User",
        entityId: user.id,
        metadata: { email, role: "ADMIN", source: "cli" },
      },
    });

    console.log(`✔ สร้างผู้ดูแลระบบ ${email} แล้ว`);
    if (!provided) {
      console.log(`  รหัสผ่านชั่วคราว: ${password}`);
      console.log("  (แสดงครั้งเดียว — ล็อกอินแล้วเปลี่ยนรหัสผ่านที่หน้าโปรไฟล์ทันที)");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
