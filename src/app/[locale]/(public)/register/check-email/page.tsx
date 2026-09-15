import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResendVerificationForm } from "@/components/features/auth/resend-verification-form";
import { AuthSplitLayout } from "@/components/layout/auth-split-layout";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { PENDING_EMAIL_COOKIE } from "@/lib/auth/constants";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/register/check-email">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.checkEmail" });
  return { title: t("title") };
}

export default async function CheckEmailPage({
  params,
}: PageProps<"/[locale]/register/check-email">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const email = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value;

  return (
    <AuthSplitLayout
      logoAlt={t("common.university")}
      asideTitle={t("auth.aside.loginTitle")}
      asideSub={t("auth.aside.loginSub")}
    >
      <div className="w-full max-w-[520px] rounded-[18px] border bg-card p-6 text-center sm:p-8">
        <div className="mx-auto mb-5 flex size-[74px] items-center justify-center rounded-full border-2 border-primary/20 bg-primary-soft text-primary">
          <Icon name="mail" size={34} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t("auth.checkEmail.title")}</h1>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-2">
          {t.rich("auth.checkEmail.body", {
            email: email ?? "—",
          })}
        </p>
        <p className="mt-2 mb-6 text-xs text-muted-foreground">{t("auth.checkEmail.hint")}</p>
        <ResendVerificationForm email={email} />
        <Link
          href="/login"
          className="mt-5 inline-block text-[13px] font-semibold text-primary hover:underline"
        >
          {t("common.backToLogin")}
        </Link>
      </div>
    </AuthSplitLayout>
  );
}
