import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma, Role } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import type { UserAction, UserQuery } from "@/lib/validations/admin";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";
import { requestPasswordReset, sendAccountInvite } from "./auth.service";

// F-AUD-05 — จัดการผู้ใช้ (ADMIN เท่านั้น)
// การระงับ/เปลี่ยนบทบาทตั้ง passwordChangedAt ใหม่ → session เดิมของผู้ใช้นั้นหมดอายุทันที

export const USER_PAGE_SIZE = 20;
const STAFF: readonly Role[] = ["ADMIN", "REGISTRAR"];

type Actor = { id: string; name: string };

export type AdminResult =
  | { ok: true }
  | {
      ok: false;
      code: "notFound" | "emailTaken" | "self" | "lastAdmin" | "roleNotAllowed" | "notApplicable";
    };

export async function listUsers(query: UserQuery) {
  const q = query.q?.trim();
  const where: Prisma.UserWhereInput = {
    AND: [
      query.role ? { role: query.role } : {},
      query.status ? { status: query.status } : {},
      q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { organization: { is: { nameTh: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {},
    ],
  };

  const [rows, total, roles] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip: (query.page - 1) * USER_PAGE_SIZE,
      take: USER_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        position: true,
        phone: true,
        lastLoginAt: true,
        lockedUntil: true,
        emailVerifiedAt: true,
        organization: { select: { nameTh: true, nameEn: true } },
        student: { select: { studentCode: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  const roleCounts: Record<Role, number> = { ADMIN: 0, REGISTRAR: 0, EXTERNAL: 0, ALUMNI: 0 };
  for (const r of roles) roleCounts[r.role] = r._count._all;
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / USER_PAGE_SIZE)), roleCounts };
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>["rows"][number];

// กันระบบไม่มีผู้ดูแลเหลืออยู่
async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const others = await prisma.user.count({
    where: { role: "ADMIN", status: "ACTIVE", id: { not: userId } },
  });
  return others === 0;
}

export async function createStaffUser(
  input: {
    name: string;
    email: string;
    role: "ADMIN" | "REGISTRAR";
    position?: string;
    phone?: string;
  },
  actor: Actor,
  context: RequestContext,
): Promise<AdminResult> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) return { ok: false, code: "emailTaken" };

  // รหัสผ่านสุ่มที่ไม่มีใครรู้ — ผู้ใช้ตั้งรหัสผ่านเองจากลิงก์ในอีเมลเชิญ
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      position: input.position,
      phone: input.phone,
      passwordHash,
      status: "ACTIVE",
      // อีเมลสถาบันที่ผู้ดูแลสร้างให้ถือว่ายืนยันแล้ว — การตั้งรหัสผ่านต้องเข้าถึงกล่องอีเมลนี้อยู่ดี
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true, name: true, locale: true, role: true },
  });

  writeAuditLog({
    action: AuditAction.USER_CREATED,
    actorId: actor.id,
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
    context,
  });
  await sendAccountInvite(user, actor.name);
  return { ok: true };
}

export async function updateUser(
  input: { userId: string; name: string; position?: string; phone?: string; role: Role },
  actor: Actor,
  context: RequestContext,
): Promise<AdminResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, position: true, phone: true, role: true, status: true },
  });
  if (!user) return { ok: false, code: "notFound" };

  const roleChanged = user.role !== input.role;
  if (roleChanged) {
    // เปลี่ยนได้เฉพาะระหว่างบทบาทเจ้าหน้าที่ — บัญชีหน่วยงาน/ศิษย์เก่าผูกกับข้อมูลที่ยืนยันตอนลงทะเบียน
    if (!STAFF.includes(user.role) || !STAFF.includes(input.role)) {
      return { ok: false, code: "roleNotAllowed" };
    }
    if (user.id === actor.id) return { ok: false, code: "self" };
    if (user.role === "ADMIN" && (await isLastActiveAdmin(user.id))) {
      return { ok: false, code: "lastAdmin" };
    }
  }

  const changed = (["name", "position", "phone"] as const).filter(
    (field) => (user[field] ?? undefined) !== input[field],
  );
  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: input.name,
      position: input.position ?? null,
      phone: input.phone ?? null,
      ...(roleChanged ? { role: input.role, passwordChangedAt: new Date() } : {}),
    },
  });

  if (changed.length > 0) {
    writeAuditLog({
      action: AuditAction.USER_UPDATED,
      actorId: actor.id,
      entityType: "User",
      entityId: user.id,
      metadata: { fields: changed },
      context,
    });
  }
  if (roleChanged) {
    writeAuditLog({
      action: AuditAction.USER_ROLE_CHANGED,
      actorId: actor.id,
      entityType: "User",
      entityId: user.id,
      metadata: { from: user.role, to: input.role },
      context,
    });
  }
  return { ok: true };
}

export async function runUserAction(
  userId: string,
  action: UserAction,
  actor: Actor,
  context: RequestContext,
): Promise<AdminResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      lockedUntil: true,
    },
  });
  if (!user) return { ok: false, code: "notFound" };
  const audit = (auditAction: (typeof AuditAction)[keyof typeof AuditAction]) =>
    writeAuditLog({
      action: auditAction,
      actorId: actor.id,
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email },
      context,
    });

  switch (action) {
    case "suspend": {
      if (user.id === actor.id) return { ok: false, code: "self" };
      if (user.status === "SUSPENDED") return { ok: false, code: "notApplicable" };
      if (user.role === "ADMIN" && (await isLastActiveAdmin(user.id))) {
        return { ok: false, code: "lastAdmin" };
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "SUSPENDED", passwordChangedAt: new Date() },
      });
      audit(AuditAction.USER_SUSPENDED);
      return { ok: true };
    }
    case "activate": {
      if (user.status !== "SUSPENDED") return { ok: false, code: "notApplicable" };
      await prisma.user.update({
        where: { id: user.id },
        // คืนสิทธิ์บัญชีที่ยังไม่ยืนยันอีเมล → กลับไปรอยืนยันเหมือนเดิม
        data: { status: user.emailVerifiedAt ? "ACTIVE" : "PENDING_VERIFICATION" },
      });
      audit(AuditAction.USER_ACTIVATED);
      return { ok: true };
    }
    case "unlock": {
      if (!user.lockedUntil) return { ok: false, code: "notApplicable" };
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
      audit(AuditAction.USER_UNLOCKED);
      return { ok: true };
    }
    case "sendReset": {
      if (user.status === "SUSPENDED") return { ok: false, code: "notApplicable" };
      await requestPasswordReset(user.email, context);
      audit(AuditAction.USER_RESET_SENT);
      return { ok: true };
    }
  }
}
