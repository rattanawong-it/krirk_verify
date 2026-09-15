import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { RequestStatusBadge } from "@/components/features/verification/request-status-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { REQUESTER_ROLES } from "@/lib/auth/rbac";
import {
  REQUEST_PAGE_SIZE,
  type RequestListRow,
  listRequests,
} from "@/lib/services/verification.service";
import { cn } from "@/lib/utils";
import { requestListQuerySchema } from "@/lib/validations/verification";
import { displayName } from "@/lib/verification/display";

// F-VER-09 — รายการคำขอ: กรองสถานะ + ค้นหา + แบ่งหน้า (ตาม project-ui/2 · คำขอของฉัน)

const FILTERS = ["PENDING_REVIEW", "APPROVED", "REJECTED", "NOT_FOUND"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/requests">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "verify.list" });
  return { title: t("title") };
}

export default async function RequestsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/requests">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const user = await requireRole(REQUESTER_ROLES);

  const filter = requestListQuerySchema.parse(await searchParams);
  const [data, t, format, currentLocale] = await Promise.all([
    listRequests(user.id, filter),
    getTranslations("verify"),
    getFormatter(),
    getLocale(),
  ]);
  if (!data) return null;

  const query = (overrides: { status?: string; page?: number }) => {
    const next: Record<string, string> = {};
    const status = "status" in overrides ? overrides.status : filter.status;
    if (status) next.status = status;
    if (filter.q) next.q = filter.q;
    const page = overrides.page ?? 1;
    if (page > 1) next.page = String(page);
    return { pathname: "/requests", query: next };
  };
  const allCount = Object.values(data.counts).reduce((sum, n) => sum + (n ?? 0), 0);

  const subject = (row: RequestListRow) =>
    row.result
      ? displayName(row.result, currentLocale)
      : row.status === "PENDING_REVIEW"
        ? t("list.pendingSubject")
        : t("list.unmatchedSubject");
  const date = (value: Date) =>
    format.dateTime(value, { day: "numeric", month: "short", year: "numeric" });

  const from = data.total === 0 ? 0 : (filter.page - 1) * REQUEST_PAGE_SIZE + 1;
  const to = Math.min(filter.page * REQUEST_PAGE_SIZE, data.total);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("list.title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {data.scope === "organization" ? t("list.subtitleOrg") : t("list.subtitleOwn")}
          </p>
        </div>
        <Button asChild className="h-11 font-semibold sm:h-[38px]">
          <Link href="/requests/new">
            <Icon name="fileAdd" size={16} />
            {t("list.newCta")}
          </Link>
        </Button>
      </div>

      <section className="overflow-hidden rounded-[15px] border bg-card">
        <div className="flex flex-col gap-3 border-b p-3.5 sm:px-4.5 lg:flex-row lg:items-center">
          <form role="search" className="relative flex-1 lg:min-w-[240px]">
            {filter.status && <input type="hidden" name="status" value={filter.status} />}
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              name="q"
              defaultValue={filter.q}
              maxLength={100}
              placeholder={t("list.searchPh")}
              aria-label={t("list.search")}
              className="h-11 w-full rounded-[9px] border bg-surface pr-3 pl-9 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 lg:h-9"
            />
          </form>
          <nav
            aria-label={t("list.filterLabel")}
            className="-mx-3.5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-3.5 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {[undefined, ...FILTERS].map((status) => {
              const active = filter.status === status;
              const count = status ? data.counts[status] : allCount;
              return (
                <Link
                  key={status ?? "all"}
                  href={query({ status })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold whitespace-nowrap sm:h-9",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-text-2 hover:bg-surface",
                  )}
                >
                  {status ? t(`statuses.${status}`) : t("list.all")}
                  {!!count && <span className="font-mono text-[11px] opacity-80">{count}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {data.rows.length === 0 ? (
          <p className="px-4.5 py-12 text-center text-sm text-muted-foreground">
            {filter.status || filter.q ? t("list.emptyFiltered") : t("list.empty")}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b bg-surface text-[11.5px] font-bold text-text-2">
                  <tr>
                    <th scope="col" className="w-[158px] px-4.5 py-2.5 font-bold">
                      {t("list.columns.ref")}
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-bold">
                      {t("list.columns.subject")}
                    </th>
                    <th scope="col" className="w-[150px] px-3 py-2.5 font-bold">
                      {t("list.columns.purpose")}
                    </th>
                    <th scope="col" className="w-[128px] px-3 py-2.5 font-bold">
                      {t("list.columns.status")}
                    </th>
                    <th scope="col" className="w-[118px] px-3 py-2.5 font-bold">
                      {t("list.columns.date")}
                    </th>
                    <th scope="col" className="w-11" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr
                      key={row.refNo}
                      className="relative border-b last:border-b-0 hover:bg-surface"
                    >
                      <td className="px-4.5 py-3">
                        <Link
                          href={`/requests/${row.refNo}`}
                          className="font-mono text-xs font-medium text-primary after:absolute after:inset-0 hover:underline"
                        >
                          {row.refNo}
                        </Link>
                      </td>
                      <td className="max-w-0 px-3 py-3">
                        <p className="truncate font-semibold">{subject(row)}</p>
                        <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                          {row.maskedKey}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-text-2">
                        {t(`purposes.${row.purpose}`)}
                      </td>
                      <td className="px-3 py-3">
                        <RequestStatusBadge
                          status={row.status}
                          label={t(`statuses.${row.status}`)}
                        />
                      </td>
                      <td className="px-3 py-3 text-[11.5px] text-text-2">{date(row.createdAt)}</td>
                      <td className="pr-4.5 text-right">
                        <Icon
                          name="chevronRight"
                          size={16}
                          className="ml-auto text-muted-foreground"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col gap-px bg-border md:hidden">
              {data.rows.map((row) => (
                <li key={row.refNo}>
                  <Link href={`/requests/${row.refNo}`} className="block bg-card px-3.5 py-3">
                    <span className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11.5px] font-medium text-primary">
                        {row.refNo}
                      </span>
                      <RequestStatusBadge
                        status={row.status}
                        label={t(`statuses.${row.status}`)}
                        compact
                      />
                    </span>
                    <span className="block text-[13px] font-semibold">{subject(row)}</span>
                    <span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground">
                      {row.maskedKey}
                    </span>
                    <span className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                      <span>{t(`purposes.${row.purpose}`)}</span>
                      <span>{date(row.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <nav className="flex flex-col gap-2 border-t bg-surface px-4.5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            {t("list.pageInfo", { from, to, total: data.total })}
          </span>
          {data.pageCount > 1 && (
            <div className="flex gap-2">
              {filter.page > 1 && (
                <Link
                  href={query({ page: filter.page - 1 })}
                  className="inline-flex h-11 items-center gap-1 rounded-lg border bg-card px-3 font-semibold hover:bg-muted md:h-8"
                >
                  <Icon name="arrowLeft" size={14} />
                  {t("list.previous")}
                </Link>
              )}
              {filter.page < data.pageCount && (
                <Link
                  href={query({ page: filter.page + 1 })}
                  className="inline-flex h-11 items-center gap-1 rounded-lg border bg-card px-3 font-semibold hover:bg-muted md:h-8"
                >
                  {t("list.next")}
                  <Icon name="chevronRight" size={14} />
                </Link>
              )}
            </div>
          )}
        </nav>
      </section>
    </div>
  );
}
