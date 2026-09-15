import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";
import { FormAlert } from "@/components/forms/form-alert";
import { AuthSplitLayout } from "@/components/layout/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getPasswordResetInfo } from "@/lib/services/auth.service";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.reset" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const { token } = await searchParams;
  const t = await getTranslations();

  const info = typeof token === "string" && token ? await getPasswordResetInfo(token) : null;

  return (
    <AuthSplitLayout
      logoAlt={t("common.university")}
      asideTitle={t("auth.aside.securityTitle")}
      asideSub={t("auth.aside.securitySub")}
    >
      {info && typeof token === "string" ? (
        <div className="w-full max-w-[440px]">
          <h1 className="text-2xl font-bold tracking-tight sm:text-[26px]">
            {t("auth.reset.title")}
          </h1>
          <p className="mt-2 mb-6 text-[13.5px] leading-relaxed break-words text-muted-foreground">
            {t("auth.reset.subtitle", { email: info.email })}
          </p>
          <div className="rounded-2xl border bg-card p-5 sm:p-6">
            <ResetPasswordForm token={token} />
          </div>
          <FormAlert variant="warning" icon="clock" className="mt-3.5">
            {t("auth.reset.expiry", { minutes: info.minutesRemaining })}
          </FormAlert>
        </div>
      ) : (
        <div className="w-full max-w-[520px] rounded-[18px] border bg-card p-6 text-center sm:p-8">
          <div className="mx-auto mb-5 flex size-[74px] items-center justify-center rounded-full border-2 border-status-rejected/20 bg-status-rejected-bg text-status-rejected">
            <Icon name="key" size={34} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("auth.reset.invalidTitle")}</h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-2">
            {t("auth.reset.invalidBody")}
          </p>
          <Button asChild className="mt-6 h-11 w-full text-[15px] font-bold">
            <Link href="/forgot-password">{t("auth.reset.requestNew")}</Link>
          </Button>
        </div>
      )}
    </AuthSplitLayout>
  );
}
