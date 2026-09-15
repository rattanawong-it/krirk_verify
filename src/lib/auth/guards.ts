import "server-only";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { getActiveSessionUser, type SessionUser } from "@/lib/services/auth.service";
import { auth } from "./index";
import type { AppRole } from "./rbac";

// F-AUTH-08: proxy กันระดับ route แต่ทุก layout/page/server action ต้องตรวจซ้ำด้วย guard นี้
// (ตาม Next.js 16 data-security guide) และตรวจกับฐานข้อมูลว่าบัญชียังใช้งานได้จริง

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getActiveSessionUser(session.user.id, session.loginAt);
});

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    return redirect({ href: "/login?reason=session", locale: await getLocale() });
  }
  return user;
}

export async function requireRole(roles: readonly AppRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    return redirect({ href: "/forbidden", locale: await getLocale() });
  }
  return user;
}
