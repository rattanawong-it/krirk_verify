import "server-only";
import type { z } from "zod";
import { type AuthTokenType, Prisma } from "@/generated/prisma/client";
import { type AppLocale, routing } from "@/i18n/routing";
import {
  getLockoutConfig,
  isLocked,
  registerFailedAttempt,
  remainingLockMinutes,
} from "@/lib/auth/lockout";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import type { AppRole } from "@/lib/auth/rbac";
import { generateToken, hashIdentifier, hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import {
  accountInviteTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "@/lib/email/templates";
import type {
  profileSchema,
  registerAlumniSchema,
  registerOrganizationSchema,
} from "@/lib/validations/auth";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";
import { getSettings } from "./settings.service";

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function appUrl(path: string, locale: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${base}${prefix}${path}`;
}

function toLocale(value: string): AppLocale {
  return value === "en" ? "en" : "th";
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function issueToken(
  tx: Prisma.TransactionClient,
  userId: string,
  type: AuthTokenType,
  ttlMs: number,
): Promise<string> {
  // มี token ที่ใช้งานได้เพียงชุดเดียวต่อประเภท
  await tx.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  const { token, tokenHash } = generateToken();
  await tx.authToken.create({
    data: { userId, type, tokenHash, expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

async function findValidToken(token: string, type: AuthTokenType) {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { organization: { select: { status: true } } } } },
  });
  if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date()) {
    return null;
  }
  return record;
}

// ------------------------------------------------------------
// Login (F-AUTH-02, F-AUTH-10)
// ------------------------------------------------------------

export type LoginFailureCode =
  "invalid" | "locked" | "unverified" | "orgPending" | "orgSuspended" | "suspended";

export type AuthenticatedUser = { id: string; email: string; name: string; role: AppRole };

export type LoginResult =
  { ok: true; user: AuthenticatedUser } | { ok: false; code: LoginFailureCode; minutes?: number };

export async function verifyCredentials(
  email: string,
  password: string,
  context: RequestContext,
): Promise<LoginResult> {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: { select: { status: true } } },
  });

  if (!user) {
    await verifyAgainstDummy(password);
    writeAuditLog({
      action: AuditAction.LOGIN_FAILED,
      metadata: { email, reason: "unknown_email" },
      context,
    });
    return { ok: false, code: "invalid" };
  }

  if (isLocked(user, now)) {
    writeAuditLog({
      action: AuditAction.LOGIN_FAILED,
      actorId: user.id,
      metadata: { reason: "locked" },
      context,
    });
    return { ok: false, code: "locked", minutes: remainingLockMinutes(user, now) };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    // จำนวนครั้งก่อนล็อกปรับได้ในหน้าตั้งค่าระบบ (F-AUD-06) · ระยะเวลาล็อกยังมาจาก env
    const config = { ...getLockoutConfig(), maxAttempts: (await getSettings()).maxFailedLogins };
    const next = registerFailedAttempt(user, now, config);
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: next.failedLoginCount, lockedUntil: next.lockedUntil },
    });
    writeAuditLog({
      action: AuditAction.LOGIN_FAILED,
      actorId: user.id,
      metadata: { reason: "bad_password", attempt: next.failedLoginCount },
      context,
    });
    if (next.justLocked) {
      writeAuditLog({
        action: AuditAction.ACCOUNT_LOCKED,
        actorId: user.id,
        entityType: "User",
        entityId: user.id,
        metadata: { minutes: config.lockMinutes },
        context,
      });
      return { ok: false, code: "locked", minutes: config.lockMinutes };
    }
    return { ok: false, code: "invalid" };
  }

  // สถานะบัญชีแจ้งหลังรหัสผ่านถูกเท่านั้น — ผู้เดาไม่รู้ว่าบัญชีอยู่สถานะใด
  const failure = accountFailure(
    user.status,
    user.emailVerifiedAt,
    user.role,
    user.organization?.status,
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      ...(failure ? {} : { lastLoginAt: now }),
    },
  });

  if (failure) {
    writeAuditLog({
      action: AuditAction.LOGIN_FAILED,
      actorId: user.id,
      metadata: { reason: failure },
      context,
    });
    return { ok: false, code: failure };
  }

  writeAuditLog({ action: AuditAction.LOGIN_SUCCESS, actorId: user.id, context });
  return { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

function accountFailure(
  status: string,
  emailVerifiedAt: Date | null,
  role: AppRole,
  orgStatus: string | undefined,
): LoginFailureCode | null {
  if (status === "SUSPENDED") return "suspended";
  if (status !== "ACTIVE" || !emailVerifiedAt) return "unverified";
  if (role === "EXTERNAL") {
    if (orgStatus === "SUSPENDED") return "orgSuspended";
    if (orgStatus !== "APPROVED") return "orgPending";
  }
  return null;
}

// ใช้ใน requireAuth — บัญชีถูกระงับ/เปลี่ยนรหัสผ่านหลังล็อกอิน → session ใช้ไม่ได้ทันที
export async function getActiveSessionUser(userId: string, loginAt: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      passwordChangedAt: true,
      organization: { select: { nameTh: true, nameEn: true, status: true } },
    },
  });
  if (!user) return null;
  if (accountFailure(user.status, user.emailVerifiedAt, user.role, user.organization?.status)) {
    return null;
  }
  if (Math.floor(user.passwordChangedAt.getTime() / 1000) > loginAt) return null;
  return user;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getActiveSessionUser>>>;

// ------------------------------------------------------------
// Registration (F-AUTH-04, F-AUTH-05)
// ------------------------------------------------------------

type RegisterOrganizationData = z.output<typeof registerOrganizationSchema>;
type RegisterAlumniData = z.output<typeof registerAlumniSchema>;

export type RegisterResult<E extends string> = { ok: true; email: string } | { ok: false; code: E };

export async function registerOrganization(
  data: RegisterOrganizationData,
  locale: AppLocale,
  context: RequestContext,
): Promise<RegisterResult<"emailTaken" | "taxIdTaken">> {
  const [emailOwner, taxOwner] = await Promise.all([
    prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
    prisma.organization.findUnique({ where: { taxId: data.taxId }, select: { id: true } }),
  ]);
  if (emailOwner) return { ok: false, code: "emailTaken" };
  if (taxOwner) return { ok: false, code: "taxIdTaken" };

  const passwordHash = await hashPassword(data.password);

  try {
    const { user, organization, token } = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          nameTh: data.nameTh,
          nameEn: data.nameEn,
          taxId: data.taxId,
          orgType: data.orgType,
          address: data.address,
          contactEmail: data.email,
          phone: data.phone,
        },
      });
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: "EXTERNAL",
          name: data.contactName,
          position: data.position,
          phone: data.phone,
          locale,
          organizationId: organization.id,
        },
      });
      const token = await issueToken(tx, user.id, "EMAIL_VERIFICATION", EMAIL_TOKEN_TTL_MS);
      return { user, organization, token };
    });

    writeAuditLog({
      action: AuditAction.REGISTER_ORGANIZATION,
      actorId: user.id,
      entityType: "Organization",
      entityId: organization.id,
      metadata: { orgType: organization.orgType },
      context,
    });

    const mail = verifyEmailTemplate({
      locale,
      kind: "organization",
      orgName: locale === "en" ? (organization.nameEn ?? organization.nameTh) : organization.nameTh,
      url: appUrl(`/verify-email?token=${token}`, locale),
    });
    await sendMail({ to: user.email, ...mail });

    return { ok: true, email: user.email };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const target = String(error.meta?.target ?? "");
      return { ok: false, code: target.includes("taxId") ? "taxIdTaken" : "emailTaken" };
    }
    throw error;
  }
}

export async function registerAlumni(
  data: RegisterAlumniData,
  locale: AppLocale,
  context: RequestContext,
): Promise<RegisterResult<"notMatched" | "alreadyRegistered" | "emailTaken">> {
  const student = await prisma.student.findFirst({
    where: { studentCode: data.studentCode, citizenIdHash: hashIdentifier(data.citizenId) },
    select: {
      id: true,
      prefixTh: true,
      firstNameTh: true,
      lastNameTh: true,
      user: { select: { id: true } },
    },
  });

  if (!student) {
    writeAuditLog({
      action: AuditAction.REGISTER_ALUMNI_NOT_MATCHED,
      metadata: { studentCode: data.studentCode },
      context,
    });
    return { ok: false, code: "notMatched" };
  }
  if (student.user) return { ok: false, code: "alreadyRegistered" };
  if (await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } })) {
    return { ok: false, code: "emailTaken" };
  }

  const passwordHash = await hashPassword(data.password);

  try {
    const { user, token } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: "ALUMNI",
          name: `${student.prefixTh ?? ""}${student.firstNameTh} ${student.lastNameTh}`.trim(),
          locale,
          studentId: student.id,
        },
      });
      const token = await issueToken(tx, user.id, "EMAIL_VERIFICATION", EMAIL_TOKEN_TTL_MS);
      return { user, token };
    });

    writeAuditLog({
      action: AuditAction.REGISTER_ALUMNI,
      actorId: user.id,
      entityType: "Student",
      entityId: student.id,
      context,
    });

    const mail = verifyEmailTemplate({
      locale,
      kind: "alumni",
      url: appUrl(`/verify-email?token=${token}`, locale),
    });
    await sendMail({ to: user.email, ...mail });

    return { ok: true, email: user.email };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const target = String(error.meta?.target ?? "");
      return { ok: false, code: target.includes("studentId") ? "alreadyRegistered" : "emailTaken" };
    }
    throw error;
  }
}

// ------------------------------------------------------------
// Email verification (F-AUTH-06)
// ------------------------------------------------------------

export type VerifyEmailResult =
  { ok: true; email: string; role: AppRole; orgStatus: string | null } | { ok: false };

export async function verifyEmailToken(
  token: string,
  context: RequestContext,
): Promise<VerifyEmailResult> {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { organization: { select: { status: true } } } } },
  });
  if (!record || record.type !== "EMAIL_VERIFICATION" || record.expiresAt <= new Date()) {
    return { ok: false };
  }

  const verifiedResult = {
    ok: true as const,
    email: record.user.email,
    role: record.user.role,
    orgStatus: record.user.organization?.status ?? null,
  };

  // ลิงก์อาจถูกเปิดไปแล้วโดยระบบสแกนลิงก์ของอีเมล — ถ้ายืนยันสำเร็จแล้วให้แสดงผลสำเร็จเช่นเดิม
  if (record.usedAt) {
    return record.user.emailVerifiedAt ? verifiedResult : { ok: false };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: now } }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        emailVerifiedAt: record.user.emailVerifiedAt ?? now,
        ...(record.user.status === "PENDING_VERIFICATION" ? { status: "ACTIVE" as const } : {}),
      },
    }),
  ]);

  writeAuditLog({
    action: AuditAction.EMAIL_VERIFIED,
    actorId: record.userId,
    entityType: "User",
    entityId: record.userId,
    context,
  });

  return {
    ok: true,
    email: record.user.email,
    role: record.user.role,
    orgStatus: record.user.organization?.status ?? null,
  };
}

// ตอบเหมือนกันทุกกรณี — ไม่เปิดเผยว่าอีเมลมีอยู่หรือยืนยันแล้วหรือไม่
export async function resendVerificationEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organization: { select: { nameTh: true, nameEn: true } },
      authTokens: {
        where: { type: "EMAIL_VERIFICATION", usedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!user || user.status !== "PENDING_VERIFICATION") return;
  const last = user.authTokens[0];
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) return;

  const locale = toLocale(user.locale);
  const token = await prisma.$transaction((tx) =>
    issueToken(tx, user.id, "EMAIL_VERIFICATION", EMAIL_TOKEN_TTL_MS),
  );
  const mail = verifyEmailTemplate({
    locale,
    kind: user.role === "ALUMNI" ? "alumni" : "organization",
    orgName:
      locale === "en"
        ? (user.organization?.nameEn ?? user.organization?.nameTh)
        : user.organization?.nameTh,
    url: appUrl(`/verify-email?token=${token}`, locale),
  });
  await sendMail({ to: user.email, ...mail });
}

// ------------------------------------------------------------
// Password reset (F-AUTH-07)
// ------------------------------------------------------------

export async function requestPasswordReset(email: string, context: RequestContext): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      authTokens: {
        where: { type: "PASSWORD_RESET", usedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  writeAuditLog({
    action: AuditAction.PASSWORD_RESET_REQUESTED,
    actorId: user?.id ?? null,
    metadata: user ? {} : { email, reason: "unknown_email" },
    context,
  });

  if (!user || user.status === "SUSPENDED") return;
  const last = user.authTokens[0];
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) return;

  const locale = toLocale(user.locale);
  const requestedAt = new Date();
  const token = await prisma.$transaction((tx) =>
    issueToken(tx, user.id, "PASSWORD_RESET", RESET_TOKEN_TTL_MS),
  );
  const mail = resetPasswordTemplate({
    locale,
    url: appUrl(`/reset-password?token=${token}`, locale),
    ipAddress: context.ipAddress,
    requestedAt,
  });
  await sendMail({ to: user.email, ...mail });
}

const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// F-AUD-05 — อีเมลเชิญเจ้าหน้าที่ที่ผู้ดูแลสร้างบัญชีให้ ใช้ token ประเภทรีเซ็ตรหัสผ่านแต่มีอายุ 24 ชั่วโมง
export async function sendAccountInvite(
  user: { id: string; email: string; name: string; locale: string; role: AppRole },
  inviterName: string,
): Promise<boolean> {
  const locale = toLocale(user.locale);
  const token = await prisma.$transaction((tx) =>
    issueToken(tx, user.id, "PASSWORD_RESET", INVITE_TOKEN_TTL_MS),
  );
  const mail = accountInviteTemplate({
    locale,
    name: user.name,
    inviterName,
    role: user.role,
    url: appUrl(`/reset-password?token=${token}`, locale),
  });
  return sendMail({ to: user.email, ...mail });
}

export async function getPasswordResetInfo(token: string) {
  const record = await findValidToken(token, "PASSWORD_RESET");
  if (!record) return null;
  const minutesRemaining = Math.max(
    1,
    Math.ceil((record.expiresAt.getTime() - Date.now()) / 60_000),
  );
  return { email: record.user.email, expiresAt: record.expiresAt, minutesRemaining };
}

export async function resetPassword(
  token: string,
  newPassword: string,
  context: RequestContext,
): Promise<{ ok: boolean }> {
  const record = await findValidToken(token, "PASSWORD_RESET");
  if (!record) return { ok: false };

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: now } }),
    prisma.authToken.deleteMany({
      where: { userId: record.userId, type: "PASSWORD_RESET", usedAt: null },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null },
    }),
  ]);

  writeAuditLog({
    action: AuditAction.PASSWORD_RESET,
    actorId: record.userId,
    entityType: "User",
    entityId: record.userId,
    context,
  });
  return { ok: true };
}

// ------------------------------------------------------------
// Profile & change password (F-AUTH-09)
// ------------------------------------------------------------

export async function getProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      position: true,
      phone: true,
      locale: true,
      role: true,
      lastLoginAt: true,
      organization: { select: { nameTh: true, nameEn: true, status: true } },
      student: { select: { studentCode: true } },
    },
  });
}

export async function updateProfile(
  userId: string,
  data: z.output<typeof profileSchema>,
  context: RequestContext,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      position: data.position ?? null,
      phone: data.phone ?? null,
      locale: data.locale,
    },
  });
  writeAuditLog({
    action: AuditAction.PROFILE_UPDATED,
    actorId: userId,
    entityType: "User",
    entityId: userId,
    context,
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  context: RequestContext,
): Promise<{ ok: true } | { ok: false; code: "wrongCurrentPassword" | "samePassword" }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return { ok: false, code: "wrongCurrentPassword" };
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    return { ok: false, code: "samePassword" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() },
  });
  writeAuditLog({
    action: AuditAction.PASSWORD_CHANGED,
    actorId: userId,
    entityType: "User",
    entityId: userId,
    context,
  });
  return { ok: true };
}
