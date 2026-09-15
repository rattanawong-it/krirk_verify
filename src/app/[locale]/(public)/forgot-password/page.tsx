import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";
import { AuthSplitLayout } from "@/components/layout/auth-split-layout";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/forgot-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.forgot" });
  return { title: t("title") };
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();

  return (
    <AuthSplitLayout
      logoAlt={t("common.university")}
      asideTitle={t("auth.aside.securityTitle")}
      asideSub={t("auth.aside.securitySub")}
    >
      <div className="w-full max-w-[420px]">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[26px]">
          {t("auth.forgot.title")}
        </h1>
        <p className="mt-2 mb-6 text-[13.5px] leading-relaxed text-muted-foreground">
          {t("auth.forgot.subtitle")}
        </p>
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <ForgotPasswordForm />
        </div>
        <p className="mt-5 text-center text-[13px] text-text-2">
          {t("auth.forgot.remembered")}{" "}
          <Link href="/login" className="font-bold text-primary hover:underline">
            {t("common.backToLogin")}
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
