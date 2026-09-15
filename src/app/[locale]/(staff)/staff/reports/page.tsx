import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Pager, buildHref } from "@/components/features/staff/pager";
import { RequestStatusBadge } from "@/components/features/verification/request-status-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import { hoursBetween } from "@/lib/reports/range";
import { REPORT_PAGE_SIZE, type ReportRow, listReport } from "@/lib/services/report.service";
import { DECISION_TYPES, REPORT_STATUSES, reportQuerySchema } from "@/lib/validations/report";
import { REQUEST_PURPOSES } from "@/lib/validations/verification";

// F-RPT-06 / F-RPT-07 — รายงานคำขอตามช่วงวันที่และเงื่อนไข + export Excel/CSV
// ไม่มีดีไซน์เฉพาะ — ใช้รูปแบบตัวกรอง/ตาราง/การ์ดมือถือเดียวกับหน้า Audit Log และคิวคำขอ

const TABLE_COLUMNS = [
  "refNo",
  "createdAt",
  "organization",
  "purpose",
  "status",
  "decisionType",
  "reviewHours",
  "faculty",
] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/reports">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "reports" });
  return { title: t("title") };
}

export default async function ReportsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/reports">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(STAFF_ROLES);

  const query = reportQuerySchema.parse(await searchParams);
  const [data, t, tv, tc, format] = await Promise.all([
    listReport(query),
    getTranslations("reports"),
    getTranslations("verify"),
    getTranslations("common"),
    getFormatter(),
  ]);

  const number = (value: number) => format.number(value);
  const dateTime = (value: Date) =>
    format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  const organizationName = (row: ReportRow) =>
    row.organization
      ? locale === "en"
        ? (row.organization.nameEn ?? row.organization.nameTh)
        : row.organization.nameTh
      : "—";
  const faculty = (row: ReportRow) =>
    row.anonymizedAt
      ? t("anonymized")
      : row.result
        ? locale === "en"
          ? (row.result.facultyEn ?? row.result.facultyTh)
          : row.result.facultyTh
        : "—";
  const reviewHours = (row: ReportRow) => {
    const hours = hoursBetween(row.createdAt, row.decidedAt);
    return hours === null ? "—" : t("hours", { hours: format.number(hours) });
  };

  const baseParams = {
    from: data.period.fromKey,
    to: data.period.toKey,
    status: query.status,
    decision: query.decision,
    purpose: query.purpose,
    org: query.org,
  };
  const exportHref = (fileFormat: "xlsx" | "csv") =>
    `/api/staff/reports/export?${new URLSearchParams(
      Object.entries({ ...baseParams, format: fileFormat, lang: locale }).filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      ),
    )}`;

  const summary = [
    { key: "total", label: t("summaryTotal"), value: number(data.total) },
    ...REPORT_STATUSES.map((status) => ({
      key: status,
      label: tv(`statuses.${status}`),
      value: number(data.byStatus[status]),
    })),
    {
      key: "auto",
      label: t("summaryAuto"),
      value: data.autoRate === null ? "—" : `${data.autoRate}%`,
    },
  ];

  const from = data.total === 0 ? 0 : (query.page - 1) * REPORT_PAGE_SIZE + 1;
  const to = Math.min(query.page * REPORT_PAGE_SIZE, data.total);
  const fieldClass =
    "h-11 w-full rounded-[9px] border bg-card px-2.5 text-[13px] font-normal text-foreground outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 lg:h-9";
  const labelClass = "flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground";

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
      <p className="mt-1 mb-4 text-[13px] text-muted-foreground">{t("subtitle")}</p>

      <form className="mb-3.5 grid gap-2.5 rounded-[15px] border bg-card p-3.5 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <label className={labelClass}>
          {t("from")}
          <input
            type="date"
            name="from"
            defaultValue={data.period.fromKey}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          {t("to")}
          <input type="date" name="to" defaultValue={data.period.toKey} className={fieldClass} />
        </label>
        <label className={labelClass}>
          {t("status")}
          <select name="status" defaultValue={query.status ?? ""} className={fieldClass}>
            <option value="">{t("allStatuses")}</option>
            {REPORT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {tv(`statuses.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("decision")}
          <select name="decision" defaultValue={query.decision ?? ""} className={fieldClass}>
            <option value="">{t("allDecisions")}</option>
            {DECISION_TYPES.map((decision) => (
              <option key={decision} value={decision}>
                {tv(`decisions.${decision}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("purpose")}
          <select name="purpose" defaultValue={query.purpose ?? ""} className={fieldClass}>
            <option value="">{t("allPurposes")}</option>
            {REQUEST_PURPOSES.map((purpose) => (
              <option key={purpose} value={purpose}>
                {tv(`purposes.${purpose}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("organization")}
          <select name="org" defaultValue={query.org ?? ""} className={fieldClass}>
            <option value="">{t("allOrganizations")}</option>
            {data.organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {locale === "en" ? (org.nameEn ?? org.nameTh) : org.nameTh}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
          <Button type="submit" className="h-11 flex-1 font-semibold sm:flex-none lg:h-9">
            <Icon name="filter" size={14} />
            {t("apply")}
          </Button>
          <Button asChild variant="ghost" className="h-11 flex-1 font-semibold sm:flex-none lg:h-9">
            <Link href="/staff/reports">{t("clear")}</Link>
          </Button>
        </div>
      </form>

      <div className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <dl className="flex flex-wrap gap-2">
          {summary.map((item) => (
            <div
              key={item.key}
              className="flex items-baseline gap-1.5 rounded-full border bg-card px-3 py-1.5 text-[12px]"
            >
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="font-bold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="h-11 flex-1 font-semibold sm:h-9">
            <a href={exportHref("xlsx")} download>
              <Icon name="download" size={16} />
              {t("exportXlsx")}
            </a>
          </Button>
          <Button asChild variant="outline" className="h-11 flex-1 font-semibold sm:h-9">
            <a href={exportHref("csv")} download>
              <Icon name="download" size={16} />
              {t("exportCsv")}
            </a>
          </Button>
        </div>
      </div>
      <p className="mb-3 text-[11.5px] text-muted-foreground">{t("exportNote")}</p>

      <section className="overflow-hidden rounded-[15px] border bg-card">
        {data.rows.length === 0 ? (
          <p className="px-4.5 py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[12.5px]">
                <thead className="border-b bg-surface text-[11.5px] text-text-2">
                  <tr>
                    {TABLE_COLUMNS.map((column) => (
                      <th key={column} scope="col" className="px-3 py-2.5 font-bold first:pl-4.5">
                        {t(`columns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="py-2.5 pr-3 pl-4.5">
                        <Link
                          href={`/staff/queue/${row.refNo}`}
                          className="font-mono text-[12px] font-medium whitespace-nowrap text-primary hover:underline"
                        >
                          {row.refNo}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-text-2">
                        {dateTime(row.createdAt)}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2.5">
                        {organizationName(row)}
                      </td>
                      <td className="px-3 py-2.5">{tv(`purposes.${row.purpose}`)}</td>
                      <td className="px-3 py-2.5">
                        <RequestStatusBadge
                          status={row.status}
                          label={tv(`statuses.${row.status}`)}
                          compact
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        {row.decisionType ? tv(`decisions.${row.decisionType}`) : "—"}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                        {reviewHours(row)}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-text-2">
                        {faculty(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-px bg-border md:hidden">
              {data.rows.map((row) => (
                <li key={row.id} className="bg-card px-3.5 py-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Link
                      href={`/staff/queue/${row.refNo}`}
                      className="inline-flex min-h-11 items-center font-mono text-[12.5px] font-medium text-primary"
                    >
                      {row.refNo}
                    </Link>
                    <RequestStatusBadge
                      status={row.status}
                      label={tv(`statuses.${row.status}`)}
                      compact
                    />
                  </div>
                  <p className="truncate text-[12.5px] font-semibold">{organizationName(row)}</p>
                  <p className="mt-0.5 text-[11.5px] text-text-2">
                    {tv(`purposes.${row.purpose}`)} · {faculty(row)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {dateTime(row.createdAt)} ·{" "}
                    {row.decisionType ? tv(`decisions.${row.decisionType}`) : "—"} ·{" "}
                    {reviewHours(row)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pager
          info={t("pageInfo", { from, to, total: data.total })}
          page={query.page}
          pageCount={data.pageCount}
          hrefFor={(page) => buildHref("/staff/reports", baseParams, page)}
          previousLabel={tc("previous")}
          nextLabel={tc("nextPage")}
        />
      </section>
    </div>
  );
}
