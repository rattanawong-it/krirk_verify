import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResendVerificationForm } from "@/components/features/auth/resend-verification-form";
import { AuthSplitLayout } from "@/components/layout/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { verifyEmailToken } from "@/lib/services/auth.service";
import { getRequestContext } from "@/lib/utils/request-context";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/verify-email">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.verifyEmail" });
  return { title: t("successTitle"), robots: { index: false } };
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/verify-email">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const { token } = await searchParams;
  const t = await getTranslations();

  const result =
    typeof token === "string" && token.length > 0
      ? await verifyEmailToken(token, await getRequestContext())
      : ({ ok: false } as const);

  return (
    <AuthSplitLayout
      logoAlt={t("common.university")}
      asideTitle={t("auth.aside.securityTitle")}
      asideSub={t("auth.aside.securitySub")}
    >
      <div className="w-full max-w-[520px] rounded-[18px] border bg-card p-6 text-center sm:p-8">
        {result.ok ? (
          <>
            <StatusBadge icon="checkCircle" tone="success" />
            <h1 className="text-2xl font-bold tracking-tight">
              {t("auth.verifyEmail.successTitle")}
            </h1>
            {result.role === "EXTERNAL" && result.orgStatus !== "APPROVED" ? (
              <>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-2">
                  {t("auth.verifyEmail.successOrg", { email: result.email })}
                </p>
                <div className="mt-6 flex items-start gap-3 rounded-[13px] border border-status-pending/25 bg-status-pending-bg p-4 text-left">
                  <Icon name="clock" size={18} className="mt-0.5 shrink-0 text-status-pending" />
                  <div>
                    <p className="text-[13px] font-bold text-status-pending-tx">
                      {t("auth.verifyEmail.pendingTitle")}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-status-pending-tx/90">
                      {t("auth.verifyEmail.pendingBody")}
                    </p>
                  </div>
                </div>
                <ol className="mt-5 space-y-3 text-left">
                  <Step
                    icon="mail"
                    done
                    title={t("auth.verifyEmail.stepEmail")}
                    sub={t("auth.verifyEmail.stepEmailDone")}
                  />
                  <Step
                    icon="shieldCheck"
                    title={t("auth.verifyEmail.stepReview")}
                    sub={t("auth.verifyEmail.stepReviewSub")}
                  />
                  <Step
                    icon="fileSearch"
                    title={t("auth.verifyEmail.stepStart")}
                    sub={t("auth.verifyEmail.stepStartSub")}
                  />
                </ol>
                <Button
                  asChild
                  variant="outline"
                  className="mt-6 h-11 w-full text-[14.5px] font-semibold"
                >
                  <Link href="/">{t("common.backToHome")}</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-2">
                  {t("auth.verifyEmail.successAlumni", { email: result.email })}
                </p>
                <Button asChild className="mt-6 h-11 w-full text-[15px] font-bold">
                  <Link href="/login">
                    <Icon name="login" size={18} />
                    {t("common.login")}
                  </Link>
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <StatusBadge icon="xCircle" tone="error" />
            <h1 className="text-2xl font-bold tracking-tight">
              {t("auth.verifyEmail.invalidTitle")}
            </h1>
            <p className="mt-2.5 mb-6 text-[13.5px] leading-relaxed text-text-2">
              {t("auth.verifyEmail.invalidBody")}
            </p>
            <ResendVerificationForm />
            <Link
              href="/login"
              className="mt-5 inline-block text-[13px] font-semibold text-primary hover:underline"
            >
              {t("common.backToLogin")}
            </Link>
          </>
        )}
      </div>
    </AuthSplitLayout>
  );
}

function StatusBadge({ icon, tone }: { icon: IconName; tone: "success" | "error" }) {
  return (
    <div
      className={cn(
        "mx-auto mb-5 flex size-[74px] items-center justify-center rounded-full border-2",
        tone === "success"
          ? "border-status-approved/20 bg-status-approved-bg text-status-approved"
          : "border-status-rejected/20 bg-status-rejected-bg text-status-rejected",
      )}
    >
      <Icon name={icon} size={34} />
    </div>
  );
}

function Step({
  icon,
  title,
  sub,
  done,
}: {
  icon: IconName;
  title: string;
  sub: string;
  done?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border bg-surface p-3">
      <span
        className={cn(
          "flex size-[34px] shrink-0 items-center justify-center rounded-[10px]",
          done ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      {done && <Icon name="checkCircle" size={18} className="text-primary" />}
    </li>
  );
}
