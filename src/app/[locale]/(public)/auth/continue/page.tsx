import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { safeCallbackUrl, stripLocalePrefix } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/guards";
import { decideAccess, getRouteAccess, homePathFor } from "@/lib/auth/rbac";

// ปลายทางหลังล็อกอิน: cookie session พร้อมแล้ว จึงรู้บทบาทและเลือกหน้าที่เหมาะสมได้
export default async function AuthContinuePage({
  params,
  searchParams,
}: PageProps<"/[locale]/auth/continue">) {
  const { locale } = await params;
  const appLocale = locale as AppLocale;
  const query = await searchParams;
  const user = await getCurrentUser();

  if (!user) return redirect({ href: "/login", locale: appLocale });

  const callback = safeCallbackUrl(query.callbackUrl);
  if (callback) {
    const target = stripLocalePrefix(callback);
    const pathname = target.split(/[?#]/)[0] ?? "/";
    const access = getRouteAccess(pathname);
    if (access.kind === "auth" && decideAccess(access, user.role) === "allow") {
      return redirect({ href: target, locale: appLocale });
    }
  }

  return redirect({ href: homePathFor(user.role), locale: appLocale });
}
