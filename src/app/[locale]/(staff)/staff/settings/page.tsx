import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { RunRetentionButton, SettingsForm } from "@/components/features/admin/settings-form";
import { Icon } from "@/components/ui/icon";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { getLockoutConfig } from "@/lib/auth/lockout";
import { getRetentionOverview } from "@/lib/services/retention.service";
import { getSettings } from "@/lib/services/settings.service";
import { toSettingsForm } from "@/lib/validations/settings";

// F-AUD-06 / F-AUD-08 — ตั้งค่าระบบ + สรุปผลนโยบายเก็บรักษาข้อมูล (ADMIN)

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "settings" });
  return { title: t("title") };
}

export default async function SettingsPage({ params }: PageProps<"/[locale]/staff/settings">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(["ADMIN"]);

  const [settings, retention, t, format] = await Promise.all([
    getSettings(),
    getRetentionOverview(),
    getTranslations("settings"),
    getFormatter(),
  ]);

  const rows = [
    { label: t("retention.due"), value: format.number(retention.due) },
    { label: t("retention.auditDue"), value: format.number(retention.auditDue) },
    { label: t("retention.anonymizedTotal"), value: format.number(retention.anonymizedTotal) },
    {
      label: t("retention.lastRun"),
      value: retention.lastRun
        ? format.dateTime(new Date(retention.lastRun.at), {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : t("retention.never"),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
      <p className="mt-1 mb-4 text-[13px] text-muted-foreground sm:mb-5">{t("subtitle")}</p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <SettingsForm
            defaults={toSettingsForm(settings)}
            lockMinutes={getLockoutConfig().lockMinutes}
          />
        </div>

        <aside className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:flex-none">
          <section className="flex items-start gap-2.5 rounded-[15px] border border-status-rejected/25 bg-status-rejected-bg p-4 text-status-rejected-tx">
            <Icon name="alert" size={18} className="mt-px shrink-0 text-status-rejected" />
            <div>
              <h2 className="mb-1 text-[12.5px] font-bold">{t("dangerTitle")}</h2>
              <p className="text-[11.5px] leading-relaxed">{t("dangerBody")}</p>
            </div>
          </section>

          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-3 text-[13px] font-bold">{t("retention.title")}</h2>
            <dl className="flex flex-col gap-2.5 text-xs">
              {rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right font-mono font-semibold">{row.value}</dd>
                </div>
              ))}
            </dl>
            <RunRetentionButton />
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {t("retention.schedule")}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
