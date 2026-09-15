import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { RequestStatusBadge } from "@/components/features/verification/request-status-badge";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import type { RequestStatus } from "@/generated/prisma/client";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { REQUESTER_ROLES } from "@/lib/auth/rbac";
import { getRequesterDashboard } from "@/lib/services/report.service";
import { getSettings } from "@/lib/services/settings.service";
import { getOwnRecordSummary } from "@/lib/services/verification.service";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/verification/display";

// F-RPT-01 — แดชบอร์ดผู้ขอ (ตาม project-ui/2 · แดชบอร์ดผู้ขอ)
// ปุ่ม "ตรวจสอบแบบชุด" ของดีไซน์ยังไม่แสดงจนกว่าจะทำ Phase 5

const STATUS_ICON: Record<RequestStatus, { icon: IconName; tone: string }> = {
  PENDING_REVIEW: { icon: "clock", tone: "bg-status-pending-bg text-status-pending" },
  APPROVED: { icon: "checkCircle", tone: "bg-primary-soft text-primary" },
  REJECTED: { icon: "xCircle", tone: "bg-status-rejected-bg text-status-rejected" },
  NOT_FOUND: { icon: "xCircle", tone: "bg-status-notfound-bg text-status-notfound" },
  EXPIRED: { icon: "clock", tone: "bg-muted text-muted-foreground" },
  DRAFT: { icon: "doc", tone: "bg-muted text-muted-foreground" },
};

const ORG_STATUS_STYLE = {
  PENDING: "bg-status-pending-bg text-status-pending-tx",
  APPROVED: "bg-status-approved-bg text-status-approved-tx",
  SUSPENDED: "bg-status-rejected-bg text-status-rejected-tx",
} as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "shell.nav" });
  return { title: t("dashboard") };
}

export default async function PortalDashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const user = await requireRole(REQUESTER_ROLES);

  const [data, record, settings, t, tv, ta, format] = await Promise.all([
    getRequesterDashboard(user.id),
    user.role === "ALUMNI" ? getOwnRecordSummary(user.id) : null,
    getSettings(),
    getTranslations("dashboard"),
    getTranslations("verify"),
    getTranslations("account"),
    getFormatter(),
  ]);
  if (!data) notFound();

  const number = (value: number) => format.number(value);
  const stats: {
    icon: IconName;
    iconTone: string;
    value: number;
    label: string;
    tag: string;
    tagTone: string;
  }[] = [
    {
      icon: "fileSearch",
      iconTone: "bg-primary-soft text-primary",
      value: data.stats.total,
      label: t("stats.total"),
      tag: t("stats.thisYear", { year: format.dateTime(new Date(), { year: "numeric" }) }),
      tagTone: "bg-muted text-muted-foreground",
    },
    {
      icon: "clock",
      iconTone: "bg-status-pending-bg text-status-pending",
      value: data.stats.pending,
      label: t("stats.pending"),
      tag: t("stats.sla", { hours: settings.slaHours }),
      tagTone: "bg-status-pending-bg text-status-pending-tx",
    },
    {
      icon: "checkCircle",
      iconTone: "bg-primary-soft text-primary",
      value: data.stats.approved,
      label: t("stats.approved"),
      tag: `${data.stats.approvedShare}%`,
      tagTone: "bg-status-approved-bg text-status-approved-tx",
    },
    {
      icon: "xCircle",
      iconTone: "bg-status-notfound-bg text-status-notfound",
      value: data.stats.negative,
      label: t("stats.negative"),
      tag: `${data.stats.negativeShare}%`,
      tagTone: "bg-status-notfound-bg text-status-notfound-tx",
    },
  ];

  const shortcuts: { href: string; icon: IconName; label: string }[] = [
    { href: "/requests/new", icon: "fileAdd", label: t("shortcutNew") },
    { href: "/requests", icon: "fileSearch", label: t("shortcutList") },
    { href: "/profile", icon: "userCircle", label: t("shortcutProfile") },
  ];
  const org = user.organization;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">
            {t("hello", { name: user.name })}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {data.scope === "organization" ? t("subOrganization") : t("subOwn")}
          </p>
        </div>
        <Button asChild className="h-11 px-5 font-semibold sm:h-10">
          <Link href="/requests/new">
            <Icon name="fileAdd" size={18} />
            {t("newRequest")}
          </Link>
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <section key={stat.label} className="rounded-[15px] border bg-card p-3.5 sm:p-4.5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-[11px]",
                  stat.iconTone,
                )}
              >
                <Icon name={stat.icon} size={18} />
              </span>
              <span
                className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", stat.tagTone)}
              >
                {stat.tag}
              </span>
            </div>
            <p className="text-[24px] font-bold tracking-tight tabular-nums sm:text-[26px]">
              {number(stat.value)}
            </p>
            <h2 className="mt-0.5 text-[12px] font-normal text-muted-foreground">{stat.label}</h2>
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="min-w-0 overflow-hidden rounded-[15px] border bg-card lg:flex-1">
          <div className="flex items-center justify-between border-b px-4 py-2.5 sm:px-4.5">
            <h2 className="text-[14.5px] font-bold">{t("recent")}</h2>
            <Link
              href="/requests"
              className="inline-flex min-h-11 items-center gap-1 text-[12.5px] font-bold text-primary"
            >
              {t("seeAll")}
              <Icon name="chevronRight" size={14} />
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <p className="px-4.5 py-10 text-center text-[13px] text-muted-foreground">
              {t("recentEmpty")}
            </p>
          ) : (
            <ul>
              {data.recent.map((row) => {
                const style = STATUS_ICON[row.status];
                const subject = row.result
                  ? displayName(row.result, locale)
                  : `${tv(`searchTypes.${row.searchType}`)} ${row.maskedKey}`;
                const date = format.dateTime(row.createdAt, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <li key={row.refNo} className="border-b last:border-b-0">
                    <Link
                      href={`/requests/${row.refNo}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface sm:gap-3.5 sm:px-4.5"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-[11px]",
                          style.tone,
                        )}
                      >
                        <Icon name={style.icon} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[12px] font-medium text-primary">
                          {row.refNo}
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-text-2">
                          {subject} · {tv(`purposes.${row.purpose}`)}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground sm:hidden">
                          {date}
                        </span>
                      </span>
                      <RequestStatusBadge
                        status={row.status}
                        label={tv(`statuses.${row.status}`)}
                        compact
                      />
                      <span className="hidden w-28 shrink-0 text-right text-[11.5px] text-muted-foreground sm:block">
                        {date}
                      </span>
                      <Icon
                        name="chevronRight"
                        size={16}
                        className="hidden shrink-0 text-muted-foreground sm:block"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:flex-none">
          {data.pendingAll > 0 && (
            <section className="flex items-start gap-2.5 rounded-[15px] border border-status-pending/30 bg-status-pending-bg p-4 text-status-pending-tx">
              <Icon name="clock" size={18} className="mt-px shrink-0 text-status-pending" />
              <div>
                <h2 className="mb-1 text-[13px] font-bold">
                  {t("pendingTitle", { count: data.pendingAll })}
                </h2>
                <p className="text-[11.5px] leading-relaxed opacity-90">{t("pendingBody")}</p>
              </div>
            </section>
          )}

          <section className="rounded-[15px] border bg-card p-4">
            <h2 className="mb-3 text-[13px] font-bold">{t("shortcuts")}</h2>
            <ul className="flex flex-col gap-2">
              {shortcuts.map((shortcut) => (
                <li key={shortcut.href}>
                  <Link
                    href={shortcut.href}
                    className="flex min-h-11 items-center gap-2.5 rounded-[10px] border bg-surface px-3 py-2 text-[12.5px] font-semibold hover:border-primary/40"
                  >
                    <Icon name={shortcut.icon} size={18} className="text-primary" />
                    <span className="flex-1">{shortcut.label}</span>
                    <Icon name="chevronRight" size={14} className="text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {org && (
            <section className="rounded-[15px] border bg-card p-4">
              <h2 className="mb-2.5 text-[13px] font-bold">{t("orgTitle")}</h2>
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                  <Icon name="building" size={18} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold">
                    {locale === "en" ? (org.nameEn ?? org.nameTh) : org.nameTh}
                  </p>
                  <span
                    className={cn(
                      "mt-0.5 inline-block rounded-full px-2 py-px text-[10px] font-bold",
                      ORG_STATUS_STYLE[org.status],
                    )}
                  >
                    {ta(`orgStatus.${org.status}`)}
                  </span>
                </div>
              </div>
              {data.organization && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {data.organization.approvedAt &&
                    `${t("orgApprovedAt", {
                      date: format.dateTime(data.organization.approvedAt, { dateStyle: "medium" }),
                    })} · `}
                  {t("orgMembers", { count: data.organization.members })}
                </p>
              )}
            </section>
          )}

          {user.role === "ALUMNI" && (
            <section className="rounded-[15px] border bg-card p-4">
              <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-bold">
                <Icon name="graduation" size={18} className="text-primary" />
                {t("recordTitle")}
              </h2>
              <p className="text-[12px] leading-relaxed text-text-2">
                {record
                  ? t("recordBody", {
                      code: record.studentCode,
                      key: `${tv(`searchTypes.${record.searchType}`)} ${record.maskedKey}`,
                    })
                  : t("recordMissing")}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
