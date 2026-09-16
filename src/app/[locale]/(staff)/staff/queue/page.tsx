import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Pager, buildHref } from "@/components/features/staff/pager";
import { QueueTable, type QueueTableRow } from "@/components/features/staff/queue-table";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import { QUEUE_PAGE_SIZE, getQueue } from "@/lib/services/review.service";
import { cn } from "@/lib/utils";
import { queueQuerySchema } from "@/lib/validations/review";
import { formatWait, slaLevel } from "@/lib/verification/sla";

// F-REG-01 / F-REG-09 — คิวคำขอรอพิจารณา (ตาม project-ui/3 Registrar Workspace · คิวคำขอ)

const REASONS = [
  "MULTIPLE_MATCHES",
  "NO_MATCH",
  "MANUAL_FLAG",
  "NOT_GRADUATED",
  "INCOMPLETE_RECORD",
  "AUTO_APPROVE_DISABLED",
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/queue">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "review" });
  return { title: t("queueTitle") };
}

export default async function QueuePage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/queue">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(STAFF_ROLES);

  const query = queueQuerySchema.parse(await searchParams);
  const now = new Date();
  const [queue, t, currentLocale] = await Promise.all([
    getQueue(query, now),
    getTranslations("review"),
    getLocale(),
  ]);

  const baseParams = {
    reason: query.reason,
    sla: query.sla,
    org: query.org,
    from: query.from,
    to: query.to,
    sort: query.sort === "newest" ? "newest" : undefined,
  };
  const chipHref = (overrides: { reason?: string; sla?: string }) =>
    buildHref(
      "/staff/queue",
      { ...baseParams, reason: undefined, sla: undefined, ...overrides },
      1,
    );

  const stats: { icon: IconName; tone: string; label: string; value: string; note: string }[] = [
    {
      icon: "clock",
      tone: "border-status-pending/25 bg-status-pending-bg text-status-pending-tx",
      label: t("stats.inQueue"),
      value: String(queue.stats.inQueue),
      note: t("stats.inQueueNote"),
    },
    {
      icon: "alert",
      tone: "border-status-rejected/25 bg-status-rejected-bg text-status-rejected-tx",
      label: t("stats.overSla"),
      value: String(queue.stats.overSla),
      note: t("stats.overSlaNote", { hours: queue.slaHours }),
    },
    {
      icon: "checkCircle",
      tone: "border-status-approved/25 bg-status-approved-bg text-status-approved-tx",
      label: t("stats.decidedToday"),
      value: String(queue.stats.decidedToday),
      note: t("stats.decidedTodayNote"),
    },
    {
      icon: "shieldCheck",
      tone: "border-status-info/25 bg-status-info-bg text-status-info-tx",
      label: t("stats.autoRate"),
      value: queue.stats.autoRate === null ? "—" : `${queue.stats.autoRate}%`,
      note: t("stats.autoRateNote"),
    },
  ];

  const rows: QueueTableRow[] = queue.rows.map((row) => {
    const level = slaLevel(row.createdAt, now, queue.slaHours);
    const orgName = row.organization
      ? currentLocale === "en"
        ? (row.organization.nameEn ?? row.organization.nameTh)
        : row.organization.nameTh
      : null;
    return {
      refNo: row.refNo,
      requesterName: row.requester.name,
      requesterEmail: row.requester.email,
      organizationName: orgName,
      maskedKey: row.maskedKey,
      reason: row.reviewReason,
      reasonLabel: row.reviewReason ? t(`reasonShort.${row.reviewReason}`) : "—",
      wait: formatWait(now.getTime() - row.createdAt.getTime()),
      sla: level,
      slaLabel: t(`sla.${level}`),
    };
  });

  const from = queue.total === 0 ? 0 : (query.page - 1) * QUEUE_PAGE_SIZE + 1;
  const to = Math.min(query.page * QUEUE_PAGE_SIZE, queue.total);
  const chipClass = (active: boolean, danger = false) =>
    cn(
      "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold whitespace-nowrap sm:h-9",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : danger
          ? "border-status-rejected/30 bg-status-rejected-bg text-status-rejected-tx"
          : "bg-card text-text-2 hover:bg-surface",
    );
  const fieldClass =
    "h-11 rounded-[9px] border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 lg:h-9";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("queueTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{t("queueSub")}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <section key={stat.label} className={cn("rounded-[14px] border p-3.5 sm:p-4", stat.tone)}>
            <p className="mb-2 flex items-center gap-2 text-[11.5px] font-bold">
              <Icon name={stat.icon} size={16} />
              {stat.label}
            </p>
            <p className="text-2xl font-bold tracking-tight tabular-nums sm:text-[25px]">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[11px]">{stat.note}</p>
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-[15px] border bg-card">
        <div className="flex flex-col gap-3 border-b p-3.5 sm:px-4.5">
          <nav
            aria-label={t("filterLabel")}
            className="-mx-3.5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-3.5 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            <Link href={chipHref({})} className={chipClass(!query.reason && !query.sla)}>
              {t("all")}
              <span className="font-mono text-[11px]">{queue.stats.inQueue}</span>
            </Link>
            <Link
              href={chipHref({ sla: "over" })}
              className={chipClass(query.sla === "over", queue.stats.overSla > 0)}
            >
              {t("overSlaChip")}
              <span className="font-mono text-[11px]">{queue.stats.overSla}</span>
            </Link>
            {REASONS.filter((reason) => queue.reasonCounts[reason]).map((reason) => (
              <Link
                key={reason}
                href={chipHref({ reason })}
                className={chipClass(query.reason === reason)}
              >
                {t(`reasonShort.${reason}`)}
                <span className="font-mono text-[11px]">{queue.reasonCounts[reason]}</span>
              </Link>
            ))}
          </nav>

          <form className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
            {query.reason && <input type="hidden" name="reason" value={query.reason} />}
            {query.sla && <input type="hidden" name="sla" value={query.sla} />}
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground lg:min-w-[220px]">
              {t("filters.organization")}
              <select name="org" defaultValue={query.org ?? ""} className={fieldClass}>
                <option value="">{t("filters.allOrganizations")}</option>
                {queue.organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {currentLocale === "en" ? (org.nameEn ?? org.nameTh) : org.nameTh}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
              {t("filters.from")}
              <input type="date" name="from" defaultValue={query.from} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
              {t("filters.to")}
              <input type="date" name="to" defaultValue={query.to} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
              {t("filters.sort")}
              <select name="sort" defaultValue={query.sort} className={fieldClass}>
                <option value="oldest">{t("filters.oldest")}</option>
                <option value="newest">{t("filters.newest")}</option>
              </select>
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:ml-auto">
              <Button type="submit" variant="outline" className="h-11 flex-1 font-semibold lg:h-9">
                <Icon name="filter" size={14} />
                {t("filters.apply")}
              </Button>
              <Button asChild variant="ghost" className="h-11 flex-1 font-semibold lg:h-9">
                <Link href="/staff/queue">{t("filters.clear")}</Link>
              </Button>
            </div>
          </form>
        </div>

        {rows.length === 0 ? (
          <p className="px-4.5 py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <QueueTable
            rows={rows}
            labels={{
              ref: t("columns.ref"),
              requester: t("columns.requester"),
              key: t("columns.key"),
              reason: t("columns.reason"),
              wait: t("columns.wait"),
            }}
          />
        )}

        <Pager
          info={t("pageInfo", { from, to, total: queue.total })}
          page={query.page}
          pageCount={queue.pageCount}
          hrefFor={(page) => buildHref("/staff/queue", baseParams, page)}
          previousLabel={t("previous")}
          nextLabel={t("next")}
        />
      </section>
    </div>
  );
}
