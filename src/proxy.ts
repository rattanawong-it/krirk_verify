import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { authConfig } from "@/lib/auth/auth.config";
import { decideAccess, getRouteAccess, homePathFor } from "@/lib/auth/rbac";

// Next.js 16 proxy (เดิม middleware): ตรวจภาษา + ป้องกันทุก route group ตามบทบาท

const { auth } = NextAuth(authConfig);
const intlMiddleware = createIntlMiddleware(routing);

const locales: readonly string[] = routing.locales;

function splitLocale(pathname: string): { locale: string | null; path: string } {
  const first = pathname.split("/")[1] ?? "";
  if (locales.includes(first)) {
    return { locale: first, path: pathname.slice(first.length + 1) || "/" };
  }
  return { locale: null, path: pathname };
}

function withLocale(path: string, locale: string | null): string {
  return locale && locale !== routing.defaultLocale ? `/${locale}${path}` : path;
}

export default auth((req) => {
  const { locale, path } = splitLocale(req.nextUrl.pathname);
  const role = req.auth?.user?.role ?? null;
  const decision = decideAccess(getRouteAccess(path), role);

  if (decision === "login") {
    const url = new URL(withLocale("/login", locale), req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (decision === "forbidden") {
    return NextResponse.redirect(new URL(withLocale("/forbidden", locale), req.nextUrl));
  }

  // ?reason=session มาจาก guard ฝั่ง server (JWT ยังอยู่แต่บัญชีใช้ไม่ได้แล้ว) — ต้องให้เข้าหน้า login ได้
  if (decision === "home" && role && !req.nextUrl.searchParams.has("reason")) {
    return NextResponse.redirect(new URL(withLocale(homePathFor(role), locale), req.nextUrl));
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|brand|.*\\..*).*)"],
};
