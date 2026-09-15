import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegisterOrganizationForm } from "@/components/features/auth/register-organization-form";
import { RegisterShell } from "@/components/layout/register-shell";
import { Icon } from "@/components/ui/icon";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/register/organization">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.registerOrg" });
  return { title: t("title") };
}

export default async function RegisterOrganizationPage({
  params,
}: PageProps<"/[locale]/register/organization">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();

  const steps = [
    {
      n: 1,
      title: t("auth.registerOrg.step1Title"),
      sub: t("auth.registerOrg.step1Sub"),
      tone: "done",
    },
    {
      n: 2,
      title: t("auth.registerOrg.step2Title"),
      sub: t("auth.registerOrg.step2Sub"),
      tone: "pending",
    },
    {
      n: 3,
      title: t("auth.registerOrg.step3Title"),
      sub: t("auth.registerOrg.step3Sub"),
      tone: "done",
    },
  ] as const;

  return (
    <RegisterShell
      logoAlt={t("common.university")}
      haveAccount={t("auth.registerOrg.haveAccount")}
      loginLabel={t("common.login")}
    >
      <div className="mx-auto max-w-[900px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11.5px] font-bold text-secondary-foreground">
          <Icon name="building" size={14} />
          {t("auth.registerOrg.badge")}
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-[28px]">
          {t("auth.registerOrg.title")}
        </h1>
        <p className="mt-2 mb-6 max-w-[640px] text-[13.5px] leading-relaxed text-muted-foreground">
          {t("auth.registerOrg.subtitle")}
        </p>

        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <RegisterOrganizationForm />
          </div>

          <aside className="flex flex-col gap-3.5 md:sticky md:top-6 md:w-[284px] md:shrink-0">
            <div className="rounded-2xl border bg-card p-4.5">
              <h2 className="mb-3.5 text-[13.5px] font-bold">
                {t("auth.registerOrg.afterSubmit")}
              </h2>
              <ol className="space-y-3.5">
                {steps.map((step, i) => (
                  <li key={step.n} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-bold",
                          step.tone === "pending"
                            ? "bg-status-pending-bg text-status-pending-tx"
                            : "bg-primary-soft text-secondary-foreground",
                        )}
                      >
                        {step.n}
                      </span>
                      {i < steps.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-1">
                      <p className="text-[12.5px] font-bold">{step.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {step.sub}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary-soft p-4">
              <Icon name="bulb" size={16} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-secondary-foreground">
                {t("auth.registerOrg.tip")}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </RegisterShell>
  );
}
