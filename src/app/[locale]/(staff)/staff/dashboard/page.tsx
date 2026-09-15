import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { StatusDonut, TrendChart } from "@/components/features/reports/charts";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import { STATUS_COLORS, TREND_COLORS } from "@/lib/reports/colors";
import { DASHBOARD_RANGES, bangkokDayKey, dayStart, share } from "@/lib/reports/range";
import { MIX_STATUSES, TREND_KEYS, getStaffDashboard } from "@/lib/services/report.service";
import { cn } from "@/lib/utils";
import { dashboardQuerySchema } from "@/lib/validations/report";

// F-RPT-02 ถึง 05 — แดชบอร์ดสถิติของเจ้าหน้าที่ (ตาม project-ui/4 · แดชบอร์ดสถิติ แบบการ์ด KPI 4 ใบ)

const LEVELS = ["BACHELOR", "MASTER", "DOCTORAL"] as const;

type Tone = "good" | "bad" | "warn" | "neutral";
const TONE: Record<Tone, string> = {
  good: "bg-status-approved-bg text-status-approved-tx",
  bad: "bg-status-rejected-bg text-status-rejected-tx",
  warn: "bg-status-pending-bg text-status-pending-tx",
  neutral: "bg-muted text-muted-foreground",
};

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "stats" });
  return { title: t("title") };
}

export default async function StaffDashboardPage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(STAFF_ROLES);

  const { range } = dashboardQuerySchema.parse(await searchParams);
  const now = new Date();
  const [data, t, tv, format] = await Promise.all([
    getStaffDashboard(range, now),
    getTranslations("stats"),
    getTranslations("verify"),
    getFormatter(),
  ]);
  const { summary, kpis, period } = data;

  const number = (value: number) => format.number(value);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${format.number(value)}`;
  // ลดลงดีกว่าสำหรับเวลาพิจารณา · ช่วงก่อนหน้าไม่มีข้อมูล = ไม่แสดงการเปลี่ยนแปลง
  const change = (
    value: number | null,
    text: (signedValue: string) => string,
    lowerIsBetter = false,
  ): { text: string; tone: Tone } =>
    value === null
      ? { text: t("kpi.noPrevious"), tone: "neutral" }
      : {
          text: text(signed(value)),
          tone: value === 0 ? "neutral" : value > 0 !== lowerIsBetter ? "good" : "bad",
        };

  const cards: {
    icon: IconName;
    iconTone: string;
    value: string;
    label: string;
    tag: { text: string; tone: Tone };
  }[] = [
    {
      icon: "fileSearch",
      iconTone: "bg-primary-soft text-primary",
      value: number(summary.total),
      label: t("kpi.total", { range: t(`ranges.${range}`) }),
      tag: change(kpis.totalChange, (v) => `${v}%`),
    },
    {
      icon: "shieldCheck",
      iconTone: "bg-primary-soft text-primary",
      value: summary.autoRate === null ? "—" : `${summary.autoRate}%`,
      label: t("kpi.autoRate"),
      tag: change(kpis.autoRateDelta, (v) => t("kpi.pointsDelta", { value: v })),
    },
    {
      icon: "clock",
      iconTone: "bg-status-pending-bg text-status-pending",
      value: number(kpis.inQueue),
      label: t("kpi.inQueue"),
      tag:
        kpis.overSla > 0
          ? { text: t("kpi.overSla", { count: kpis.overSla }), tone: "bad" }
          : { text: t("kpi.sla", { hours: data.slaHours }), tone: "warn" },
    },
    {
      icon: "history",
      iconTone: "bg-status-info-bg text-status-info",
      value:
        summary.avgReviewHours === null
          ? "—"
          : t("kpi.hours", { hours: format.number(summary.avgReviewHours) }),
      label: t("kpi.avgReview"),
      tag: change(kpis.avgReviewChange, (v) => `${v}%`, true),
    },
  ];

  const series = TREND_KEYS.map((key) => ({
    key,
    label: t(`series.${key}`),
    color: TREND_COLORS[key],
  }));
  const trend = data.trend.map((point) => ({
    ...point,
    label:
      period.granularity === "day"
        ? format.dateTime(dayStart(point.bucket), { day: "numeric", month: "short" })
        : format.dateTime(dayStart(`${point.bucket}-01`), { month: "short", year: "2-digit" }),
  }));
  const mix = MIX_STATUSES.map((status) => ({
    key: status,
    label: tv(`statuses.${status}`),
    value: summary.byStatus[status],
    fill: STATUS_COLORS[status],
  }));

  const periodParams = { from: bangkokDayKey(period.from), to: bangkokDayKey(now) };
  const reportsHref = `/staff/reports?${new URLSearchParams(periodParams)}`;
  const exportHref = `/api/staff/reports/export?${new URLSearchParams({ ...periodParams, format: "xlsx", lang: locale })}`;
  const maxOrg = data.topOrganizations[0]?.count ?? 0;
  const maxFaculty = data.faculties[0]?.count ?? 0;
  const empty = (
    <p className="py-8 text-center text-[12.5px] text-muted-foreground">{t("empty")}</p>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <nav aria-label={t("rangeLabel")} className="flex rounded-[9px] bg-muted p-[3px]">
            {DASHBOARD_RANGES.map((item) => (
              <Link
                key={item}
                href={`/staff/dashboard?range=${item}`}
                aria-current={item === range ? "page" : undefined}
                className={cn(
                  "flex min-h-10 flex-1 items-center justify-center rounded-[7px] px-3.5 text-[12px] sm:min-h-8",
                  item === range
                    ? "bg-card font-bold text-primary shadow-sm"
                    : "font-semibold text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`ranges.${item}`)}
              </Link>
            ))}
          </nav>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="h-11 flex-1 font-semibold sm:h-[38px]">
              <Link href={reportsHref}>
                <Icon name="filter" size={16} />
                {t("openReports")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 flex-1 font-semibold sm:h-[38px]">
              <a href={exportHref} download>
                <Icon name="download" size={16} />
                {t("export")}
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <section key={card.label} className="rounded-[15px] border bg-card p-3.5 sm:p-4">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
                  card.iconTone,
                )}
              >
                <Icon name={card.icon} size={18} />
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-right text-[10.5px] font-bold",
                  TONE[card.tag.tone],
                )}
              >
                {card.tag.text}
              </span>
            </div>
            <p className="text-[22px] font-bold tracking-tight tabular-nums sm:text-[25px]">
              {card.value}
            </p>
            <h2 className="mt-0.5 text-[11.5px] font-normal text-muted-foreground">{card.label}</h2>
          </section>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <section className="min-w-0 rounded-[15px] border bg-card p-4 sm:p-5 lg:flex-[1.6]">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[14.5px] font-bold">{t("trendTitle")}</h2>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {period.granularity === "day"
                  ? t("trendSubDay", { count: period.buckets.length })
                  : t("trendSubMonth")}
              </p>
            </div>
            <ul className="flex flex-wrap gap-x-3.5 gap-y-1">
              {series.map((item) => (
                <li key={item.key} className="flex items-center gap-1.5 text-[11px] text-text-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-[3px]"
                    style={{ background: item.color }}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          <TrendChart
            data={trend}
            series={series}
            summary={t("chartSummary", { total: number(summary.total) })}
          />
        </section>

        <section className="min-w-0 rounded-[15px] border bg-card p-4 sm:p-5 lg:flex-1">
          <h2 className="text-[14.5px] font-bold">{t("mixTitle")}</h2>
          <p className="mt-0.5 mb-4 text-[11.5px] text-muted-foreground">{t("mixSub")}</p>
          <div className="flex items-center gap-5">
            <StatusDonut
              data={mix}
              total={number(summary.total)}
              totalLabel={t("requests")}
              summary={mix.map((item) => `${item.label} ${item.value}`).join(", ")}
            />
            <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
              {mix.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-[11.5px]">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: item.fill }}
                  />
                  <span className="min-w-0 flex-1 truncate text-text-2">{item.label}</span>
                  <span className="font-bold tabular-nums">{number(item.value)}</span>
                  <span className="w-9 text-right font-mono text-[10.5px] text-muted-foreground">
                    {share(item.value, summary.total)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[15px] border bg-card p-4 sm:p-5">
          <h2 className="mb-3.5 text-[14.5px] font-bold">{t("topOrgs")}</h2>
          {data.topOrganizations.length === 0 ? (
            empty
          ) : (
            <ol className="flex flex-col gap-3">
              {data.topOrganizations.map((org, index) => (
                <li key={org.id}>
                  <div className="mb-1.5 flex items-baseline gap-2.5">
                    <span className="w-5 font-mono text-[10.5px] text-muted-foreground">
                      {index + 1}
                    </span>
                    <Link
                      href={`/staff/organizations/${org.id}`}
                      className="min-w-0 flex-1 truncate text-[12.5px] font-semibold hover:text-primary hover:underline"
                    >
                      {locale === "en" ? (org.nameEn ?? org.nameTh) : org.nameTh}
                    </Link>
                    <span className="text-[12px] font-bold tabular-nums">{number(org.count)}</span>
                  </div>
                  <div aria-hidden className="ml-7.5 h-1.5 overflow-hidden rounded bg-muted">
                    <div
                      className={cn("h-full rounded", index < 2 ? "bg-primary" : "bg-primary/55")}
                      style={{ width: `${share(org.count, maxOrg)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-[15px] border bg-card p-4 sm:p-5">
          <h2 className="text-[14.5px] font-bold">{t("byFaculty")}</h2>
          <p className="mt-0.5 mb-3.5 text-[11px] text-muted-foreground">{t("resultNote")}</p>
          {data.faculties.length === 0 ? (
            empty
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.faculties.map((faculty) => (
                <li key={faculty.nameTh} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[12px] text-text-2 sm:w-40">
                    {locale === "en" ? (faculty.nameEn ?? faculty.nameTh) : faculty.nameTh}
                  </span>
                  <div aria-hidden className="h-5 flex-1 overflow-hidden rounded-md bg-muted">
                    <div
                      className="h-full rounded-md bg-primary/80"
                      style={{ width: `${share(faculty.count, maxFaculty)}%` }}
                    />
                  </div>
                  <span className="w-11 text-right text-[12px] font-bold tabular-nums">
                    {number(faculty.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.levels.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 text-[12.5px] font-bold">{t("byLevel")}</h3>
              <ul className="flex flex-wrap gap-2">
                {data.levels.map((level) => (
                  <li
                    key={level.level}
                    className="flex items-baseline gap-1.5 rounded-full border bg-surface px-3 py-1 text-[12px]"
                  >
                    <span className="text-text-2">
                      {(LEVELS as readonly string[]).includes(level.level)
                        ? tv(`levels.${level.level as (typeof LEVELS)[number]}`)
                        : level.level}
                    </span>
                    <span className="font-bold tabular-nums">{number(level.count)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
