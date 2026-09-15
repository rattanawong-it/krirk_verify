import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/features/auth/login-form";
import { AuthSplitLayout } from "@/components/layout/auth-split-layout";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { safeCallbackUrl } from "@/lib/auth/constants";
import { getLockoutConfig } from "@/lib/auth/lockout";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.login" });
  return { title: t("title") };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const query = await searchParams;
  const t = await getTranslations();
  const { maxAttempts, lockMinutes } = getLockoutConfig();

  const notice =
    query.reason === "passwordChanged"
      ? { variant: "success" as const, text: t("auth.login.passwordChanged") }
      : query.reason === "session"
        ? { variant: "warning" as const, text: t("auth.login.sessionExpired") }
        : undefined;

  return (
    <AuthSplitLayout
      logoAlt={t("common.university")}
      asideTitle={t("auth.aside.loginTitle")}
      asideSub={t("auth.aside.loginSub")}
      points={[
        { icon: "lock", text: t("auth.aside.point1") },
        { icon: "shield", text: t("auth.aside.point2") },
        { icon: "history", text: t("auth.aside.point3") },
      ]}
    >
      <div className="w-full max-w-[400px]">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[27px]">
          {t("auth.login.title")}
        </h1>
        <p className="mt-1.5 mb-6 text-[13.5px] leading-relaxed text-muted-foreground">
          {t("auth.login.subtitle")}
        </p>
        <div className="rounded-2xl border bg-card p-5 shadow-[0_2px_12px_rgba(28,107,33,0.05)] sm:p-6">
          <LoginForm
            callbackUrl={safeCallbackUrl(query.callbackUrl) ?? undefined}
            notice={notice}
            lockNote={t("auth.login.lockNote", { max: maxAttempts, minutes: lockMinutes })}
          />
        </div>
        <p className="mt-5 text-center text-[13px] leading-7 text-text-2">
          {t("auth.login.noAccount")}{" "}
          <Link href="/register/organization" className="font-bold text-primary hover:underline">
            {t("auth.login.registerOrg")}
          </Link>
          {" · "}
          <Link href="/register/alumni" className="font-bold text-primary hover:underline">
            {t("auth.login.registerAlumni")}
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
