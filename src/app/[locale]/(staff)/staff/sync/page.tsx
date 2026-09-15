import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { RegistryHealth } from "@/components/features/sync/registry-health";
import { RunSyncButton } from "@/components/features/sync/run-sync-button";
import { SyncAutoRefresh } from "@/components/features/sync/sync-auto-refresh";
import { SyncHistory } from "@/components/features/sync/sync-history";
import { SyncStatusBanner } from "@/components/features/sync/sync-status-banner";
import { Icon } from "@/components/ui/icon";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import { getRegistryInfo, getSyncOverview } from "@/lib/services/sync.service";

// F-DATA-08 — ตามดีไซน์ project-ui/4 Admin & Reports (หน้า Sync)

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/sync">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "sync" });
  return { title: t("title") };
}

function InfoRow({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 text-right font-semibold break-all ${mono ? "font-mono text-[11.5px]" : ""}`}
      >
        {children}
      </dd>
    </div>
  );
}

export default async function StaffSyncPage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/sync">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(STAFF_ROLES);

  const rawPage = (await searchParams).page;
  const requestedPage = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [overview, t, format] = await Promise.all([
    getSyncOverview(page),
    getTranslations("sync"),
    getFormatter(),
  ]);
  const registry = getRegistryInfo();
  const isRunning = overview.running !== null;

  return (
    <div className="mx-auto max-w-6xl">
      <SyncAutoRefresh active={isRunning} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("subtitle")}</p>
        </div>
        <RunSyncButton running={isRunning} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <SyncStatusBanner
            running={overview.running}
            latest={overview.latestBulk}
            lastSuccess={overview.lastSuccess}
            studentCount={overview.studentCount}
          />
          <SyncHistory jobs={overview.jobs} page={page} pageCount={overview.pageCount} />
        </div>

        <aside className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:flex-none">
          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-3 text-[13.5px] font-bold">{t("api.title")}</h2>
            <dl className="flex flex-col gap-2.5 text-xs">
              <InfoRow label={t("api.client")} mono>
                {registry.clientName}
              </InfoRow>
              <InfoRow label={t("api.endpoint")} mono>
                {registry.endpoint}
              </InfoRow>
              <InfoRow label={t("api.health")}>
                <Suspense
                  fallback={<span className="text-muted-foreground">{t("api.checking")}</span>}
                >
                  <RegistryHealth />
                </Suspense>
              </InfoRow>
              <InfoRow label={t("api.schedule")} mono>
                {registry.schedule}
              </InfoRow>
              <InfoRow label={t("api.records")} mono>
                {format.number(overview.studentCount)}
              </InfoRow>
            </dl>
          </section>

          {registry.clientName === "MockRegistryClient" && (
            <section className="flex items-start gap-2.5 rounded-[15px] border border-status-info/25 bg-status-info-bg p-4 text-status-info-tx">
              <Icon name="info" size={18} className="mt-px shrink-0 text-status-info" />
              <p className="text-xs leading-relaxed">{t("mockNote")}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
