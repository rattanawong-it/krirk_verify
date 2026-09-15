"use server";

import { AuthError, type CredentialsSignin } from "next-auth";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { signIn, signOut } from "@/lib/auth";
import { PENDING_EMAIL_COOKIE, safeCallbackUrl } from "@/lib/auth/constants";
import { requireAuth } from "@/lib/auth/guards";
import * as authService from "@/lib/services/auth.service";
import { type ActionState, fieldErrorsOf } from "@/lib/utils/action-state";
import { getRequestContext } from "@/lib/utils/request-context";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  registerAlumniSchema,
  registerOrganizationSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

// Server Action = auth + validate + เรียก service เท่านั้น (spec ข้อ 5.2)

export type { ActionState };

const LOGIN_ERROR_CODES = new Set([
  "invalid",
  "locked",
  "unverified",
  "orgPending",
  "orgSuspended",
  "suspended",
]);

async function currentLocale(): Promise<AppLocale> {
  return (await getLocale()) === "en" ? "en" : "th";
}

async function rememberPendingEmail(email: string) {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30,
    path: "/",
  });
}

export async function loginAction(input: unknown, callbackUrl?: string): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const locale = await currentLocale();
  const safeCallback = safeCallbackUrl(callbackUrl);
  const continuePath = getPathname({
    href: { pathname: "/auth/continue", query: safeCallback ? { callbackUrl: safeCallback } : {} },
    locale,
  });

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      remember: String(parsed.data.remember),
      redirectTo: continuePath,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const raw =
        error.type === "CredentialsSignin" ? ((error as CredentialsSignin).code ?? "") : "";
      const [code = "", minutes = "0"] = raw.split(":");
      return {
        ok: false,
        error: `auth.login.errors.${LOGIN_ERROR_CODES.has(code) ? code : "unknown"}`,
        errorValues: { minutes: Number(minutes) },
      };
    }
    throw error;
  }
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  const locale = await currentLocale();
  await signOut({ redirectTo: getPathname({ href: "/login", locale }) });
}

export async function registerOrganizationAction(input: unknown): Promise<ActionState> {
  const parsed = registerOrganizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const locale = await currentLocale();
  const result = await authService.registerOrganization(
    parsed.data,
    locale,
    await getRequestContext(),
  );
  if (!result.ok) {
    const key = `auth.registerOrg.errors.${result.code}`;
    return {
      ok: false,
      error: key,
      fieldErrors: result.code === "emailTaken" ? { email: key } : { taxId: key },
    };
  }

  await rememberPendingEmail(result.email);
  return redirect({ href: "/register/check-email", locale });
}

export async function registerAlumniAction(input: unknown): Promise<ActionState> {
  const parsed = registerAlumniSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const locale = await currentLocale();
  const result = await authService.registerAlumni(parsed.data, locale, await getRequestContext());
  if (!result.ok) {
    const key = `auth.registerAlumni.errors.${result.code}`;
    return {
      ok: false,
      error: key,
      fieldErrors: result.code === "emailTaken" ? { email: key } : undefined,
    };
  }

  await rememberPendingEmail(result.email);
  return redirect({ href: "/register/check-email", locale });
}

export async function resendVerificationAction(input: unknown): Promise<ActionState> {
  const parsed = resendVerificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  await authService.resendVerificationEmail(parsed.data.email);
  return { ok: true, message: "auth.checkEmail.resent" };
}

export async function forgotPasswordAction(input: unknown): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  await authService.requestPasswordReset(parsed.data.email, await getRequestContext());
  return { ok: true, message: "auth.forgot.sent" };
}

export async function resetPasswordAction(input: unknown): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await authService.resetPassword(
    parsed.data.token,
    parsed.data.password,
    await getRequestContext(),
  );
  if (!result.ok) return { ok: false, error: "auth.reset.invalidTitle" };

  return redirect({
    href: { pathname: "/login", query: { reason: "passwordChanged" } },
    locale: await currentLocale(),
  });
}

export async function changePasswordAction(input: unknown): Promise<ActionState> {
  const user = await requireAuth();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await authService.changePassword(
    user.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
    await getRequestContext(),
  );
  if (!result.ok) {
    const key = `account.${result.code}`;
    return {
      ok: false,
      fieldErrors:
        result.code === "wrongCurrentPassword" ? { currentPassword: key } : { newPassword: key },
    };
  }

  const locale = await currentLocale();
  await signOut({
    redirectTo: getPathname({
      href: { pathname: "/login", query: { reason: "passwordChanged" } },
      locale,
    }),
  });
  return { ok: true };
}

export async function updateProfileAction(input: unknown): Promise<ActionState> {
  const user = await requireAuth();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  await authService.updateProfile(user.id, parsed.data, await getRequestContext());
  return { ok: true, message: "account.profileSaved" };
}
