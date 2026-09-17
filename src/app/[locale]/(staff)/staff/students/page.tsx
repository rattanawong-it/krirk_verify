import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Pager, buildHref } from "@/components/features/staff/pager";
import { STUDENT_STATUS_TONE, StatusPill } from "@/components/features/staff/status-pill";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import {
  STUDENT_PAGE_SIZE,
  getRegistrySummary,
  searchStudents,
} from "@/lib/services/student.service";
import { getRequestContext } from "@/lib/utils/request-context";
import { studentQuerySchema } from "@/lib/validations/review";
import { sortFacultyOptions } from "@/lib/verification/faculty-options";
import {
  degreeLabel,
  displayName,
  fullNameEn,
  graduationTermLabel,
} from "@/lib/verification/display";

// F-REG-07 — ค้นหาข้อมูลผู้สำเร็จการศึกษา (ตาม project-ui/3 · ผู้สำเร็จการศึกษา)

const STATUSES = ["GRADUATED", "STUDYING", "WITHDRAWN", "REVOKED"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/students">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "students" });
  return { title: t("title") };
}

export default async function StudentsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/students">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const staff = await requireRole(STAFF_ROLES);

  const query = studentQuerySchema.parse(await searchParams);
  const [result, summary, t, tv, format, currentLocale] = await Promise.all([
    searchStudents(query, staff, await getRequestContext()),
    getRegistrySummary(),
    getTranslations("students"),
    getTranslations("verify"),
    getFormatter(),
    getLocale(),
  ]);

  const baseParams = {
    q: query.q,
    faculty: query.faculty,
    status: query.status,
    flagged: query.flagged,
  };
  const from = result.total === 0 ? 0 : (query.page - 1) * STUDENT_PAGE_SIZE + 1;
  const to = Math.min(query.page * STUDENT_PAGE_SIZE, result.total);
  const date = (value: Date | null) =>
    value
      ? format.dateTime(value, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : "—";
  const graduated = (row: { graduationDate: Date | null; graduationTerm: string | null }) =>
    row.graduationDate || !row.graduationTerm
      ? date(row.graduationDate)
      : (graduationTermLabel(row.graduationTerm, currentLocale) ?? "—");
  const fieldClass =
    "h-11 rounded-[9px] border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 lg:h-9";

  const counts: { icon: IconName; tone: string; label: string; value: number }[] = [
    { icon: "sync", tone: "bg-primary-soft text-primary", label: t("total"), value: summary.total },
    {
      icon: "graduation",
      tone: "bg-primary-soft text-primary",
      label: t("graduated"),
      value: summary.graduated,
    },
    {
      icon: "alert",
      tone: "bg-status-rejected-bg text-status-rejected",
      label: t("flagged"),
      value: summary.flagged,
    },
    {
      icon: "passport",
      tone: "bg-status-info-bg text-status-info",
      label: t("passport"),
      value: summary.passport,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild variant="outline" className="h-11 font-semibold sm:h-[38px]">
          <Link href="/staff/sync">
            <Icon name="sync" size={16} />
            {t("syncLink")}
          </Link>
        </Button>
      </div>

      <p className="mb-4 flex items-start gap-2.5 rounded-[13px] border border-gold/40 bg-gold-soft p-3.5 text-xs leading-relaxed text-[#6b4e0a] dark:text-gold">
        <Icon name="lock" size={18} className="shrink-0 text-gold" />
        {t("pdpa")}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="min-w-0 flex-1 overflow-hidden rounded-[15px] border bg-card">
          <form
            role="search"
            className="grid gap-2 border-b p-3.5 sm:grid-cols-2 sm:px-4.5 lg:flex lg:flex-wrap lg:items-center"
          >
            <div className="relative sm:col-span-2 lg:min-w-[220px] lg:flex-1">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                name="q"
                defaultValue={query.q}
                maxLength={100}
                aria-label={t("search")}
                placeholder={t("searchPh")}
                className={`${fieldClass} w-full bg-surface pl-9`}
              />
            </div>
            <select
              name="faculty"
              defaultValue={query.faculty ?? ""}
              aria-label={t("faculty")}
              className={fieldClass}
            >
              <option value="">{t("allFaculties")}</option>
              {sortFacultyOptions(summary.faculties, currentLocale).map((f) => (
                <option key={f.value} value={f.value}>
                  {currentLocale === "en" ? f.labelEn : f.labelTh}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={query.status ?? ""}
              aria-label={t("status")}
              className={fieldClass}
            >
              <option value="">{t("allStatuses")}</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {tv(`studentStatuses.${status}`)}
                </option>
              ))}
            </select>
            <label className="flex min-h-11 items-center gap-2 text-[12.5px] lg:min-h-9">
              <input
                type="checkbox"
                name="flagged"
                value="1"
                defaultChecked={!!query.flagged}
                className="size-4 accent-primary"
              />
              {t("flaggedOnly")}
            </label>
            <Button type="submit" className="h-11 font-semibold lg:h-9">
              {t("search")}
            </Button>
          </form>

          {result.rows.length === 0 ? (
            <p className="px-4.5 py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b bg-surface text-[11.5px] font-bold text-text-2">
                    <tr>
                      <th scope="col" className="w-[126px] px-4.5 py-2.5 font-bold">
                        {t("columns.code")}
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-bold">
                        {t("columns.name")}
                      </th>
                      <th scope="col" className="w-[210px] px-3 py-2.5 font-bold">
                        {t("columns.program")}
                      </th>
                      <th scope="col" className="w-[130px] px-3 py-2.5 font-bold">
                        {t("columns.status")}
                      </th>
                      <th scope="col" className="w-[110px] px-3 py-2.5 font-bold">
                        {t("columns.graduated")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr
                        key={row.id}
                        className="relative border-b last:border-b-0 hover:bg-surface"
                      >
                        <td className="px-4.5 py-3">
                          <Link
                            href={`/staff/students/${row.studentCode}`}
                            className="font-mono text-xs font-medium text-primary after:absolute after:inset-0 hover:underline"
                          >
                            {row.studentCode}
                          </Link>
                        </td>
                        <td className="max-w-0 px-3 py-3">
                          <p className="truncate font-semibold">
                            {displayName(row, currentLocale)}
                          </p>
                          {currentLocale !== "en" && fullNameEn(row) && (
                            <p className="truncate text-[10.5px] text-muted-foreground">
                              {fullNameEn(row)}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-[11.5px] leading-snug text-text-2">
                          {degreeLabel(row, currentLocale)}
                          <span className="block text-muted-foreground">
                            {currentLocale === "en"
                              ? (row.facultyEn ?? row.facultyTh)
                              : row.facultyTh}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill
                            tone={STUDENT_STATUS_TONE[row.status]}
                            icon={row.requiresManualReview ? "alert" : undefined}
                            label={tv(`studentStatuses.${row.status}`)}
                          />
                        </td>
                        <td className="px-3 py-3 text-[11.5px] text-text-2">{graduated(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="flex flex-col gap-px bg-border md:hidden">
                {result.rows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/staff/students/${row.studentCode}`}
                      className="block bg-card px-3.5 py-3"
                    >
                      <span className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-mono text-[11.5px] font-medium text-primary">
                          {row.studentCode}
                        </span>
                        <StatusPill
                          tone={STUDENT_STATUS_TONE[row.status]}
                          icon={row.requiresManualReview ? "alert" : undefined}
                          label={tv(`studentStatuses.${row.status}`)}
                          compact
                        />
                      </span>
                      <span className="block text-[13px] font-semibold">
                        {displayName(row, currentLocale)}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                        {degreeLabel(row, currentLocale)} · {graduated(row)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Pager
            info={t("pageInfo", { from, to, total: result.total })}
            page={query.page}
            pageCount={result.pageCount}
            hrefFor={(page) => buildHref("/staff/students", baseParams, page)}
            previousLabel={tv("list.previous")}
            nextLabel={tv("list.next")}
          />
        </section>

        <aside className="flex w-full flex-col gap-3.5 lg:w-[290px] lg:flex-none">
          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-3 text-[13.5px] font-bold">{t("summary")}</h2>
            <ul className="flex flex-col gap-2.5">
              {counts.map((count) => (
                <li key={count.label} className="flex items-center gap-2.5">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] ${count.tone}`}
                  >
                    <Icon name={count.icon} size={16} />
                  </span>
                  <span className="flex-1 text-[12.5px] text-text-2">{count.label}</span>
                  <span className="text-[14.5px] font-bold tabular-nums">
                    {format.number(count.value)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="flex items-start gap-2.5 rounded-[15px] border border-status-rejected/25 bg-status-rejected-bg p-4 text-status-rejected-tx">
            <Icon name="alert" size={18} className="mt-px shrink-0 text-status-rejected" />
            <div>
              <p className="mb-1 text-[12.5px] font-bold">{t("manualFlagTitle")}</p>
              <p className="text-[11.5px] leading-relaxed">{t("manualFlagBody")}</p>
              <Link
                href={buildHref("/staff/students", { flagged: "1" }, 1)}
                className="mt-2 inline-flex min-h-11 items-center text-[12px] font-bold underline-offset-2 hover:underline sm:min-h-0"
              >
                {t("flaggedOnly")}
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
