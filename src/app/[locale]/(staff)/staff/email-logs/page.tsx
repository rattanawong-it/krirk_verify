import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ResendEmailButton } from "@/components/features/admin/resend-email-button";
import { Pager, buildHref } from "@/components/features/staff/pager";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { MAX_EMAIL_ATTEMPTS } from "@/lib/email/mailer";
import {
  EMAIL_LOG_PAGE_SIZE,
  type EmailLogRow,
  listEmailLogs,
  usedTemplates,
} from "@/lib/services/email-log.service";
import { cn } from "@/lib/utils";
import { AUDIT_RANGES, EMAIL_STATUSES, emailLogQuerySchema } from "@/lib/validations/admin";

// F-NOT-04 — ประวัติการส่งอีเมล + ส่งซ้ำ (ADMIN เท่านั้น · เลื่อนมาจาก Phase 7)

const STATUS_STYLE: Record<EmailLogRow["status"], string> = {
  SENT: "bg-status-approved-bg text-status-approved-tx",
  PENDING: "bg-status-pending-bg text-status-pending-tx",
  FAILED: "bg-status-rejected-bg text-status-rejected-tx",
};

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/email-logs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "emailLogs" });
  return { title: t("title") };
}

export default async function EmailLogsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/email-logs">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(["ADMIN"]);

  const query = emailLogQuerySchema.parse(await searchParams);
  const [data, templates, t, tc, format] = await Promise.all([
    listEmailLogs(query),
    usedTemplates(),
    getTranslations("emailLogs"),
    getTranslations("common"),
    getFormatter(),
  ]);

  const templateLabel = (name: string) => {
    const key = `templates.${name}`;
    return t.has(key as never) ? t(key as never) : name;
  };
  const baseParams = {
    q: query.q,
    status: query.status,
    template: query.template,
    range: query.range === "7d" ? undefined : query.range,
  };
  const from = data.total === 0 ? 0 : (query.page - 1) * EMAIL_LOG_PAGE_SIZE + 1;
  const to = Math.min(query.page * EMAIL_LOG_PAGE_SIZE, data.total);
  const fieldClass =
    "h-11 rounded-[9px] border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 lg:h-9";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{t("subtitle")}</p>
      </div>

      {data.failed > 0 && (
        <p
          role="note"
          className="mb-3.5 flex items-center gap-2.5 rounded-[13px] border border-status-rejected/30 bg-status-rejected-bg px-4 py-3 text-[12.5px] text-status-rejected-tx"
        >
          <Icon name="alert" size={16} />
          {t("failedBanner", { count: data.failed })}
        </p>
      )}

      <form className="mb-3.5 grid gap-2 rounded-[15px] border bg-card p-3.5 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
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
          name="status"
          defaultValue={query.status ?? ""}
          aria-label={t("fields.status")}
          className={fieldClass}
        >
          <option value="">{t("allStatuses")}</option>
          {EMAIL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statuses.${status}`)}
            </option>
          ))}
        </select>
        <select
          name="template"
          defaultValue={query.template ?? ""}
          aria-label={t("fields.template")}
          className={fieldClass}
        >
          <option value="">{t("allTemplates")}</option>
          {templates.map((name) => (
            <option key={name} value={name}>
              {templateLabel(name)}
            </option>
          ))}
        </select>
        <select
          name="range"
          defaultValue={query.range}
          aria-label={t("fields.created")}
          className={fieldClass}
        >
          {AUDIT_RANGES.map((range) => (
            <option key={range} value={range}>
              {t(`ranges.${range}` as never)}
            </option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" variant="outline" className="h-11 flex-1 font-semibold lg:h-9">
            <Icon name="filter" size={14} />
            {t("apply")}
          </Button>
          <Button asChild variant="ghost" className="h-11 flex-1 font-semibold lg:h-9">
            <Link href="/staff/email-logs">{t("clear")}</Link>
          </Button>
        </div>
      </form>

      {data.rows.length === 0 ? (
        <p className="rounded-[15px] border bg-card px-4.5 py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-[13px] border bg-card p-3.5 sm:flex-row sm:items-start sm:gap-3.5 sm:px-4"
            >
              <div className="min-w-0 flex-1">
                <p className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-bold",
                      STATUS_STYLE[row.status],
                    )}
                  >
                    {t(`statuses.${row.status}`)}
                  </span>
                  <span className="text-[12.5px] font-semibold">{templateLabel(row.template)}</span>
                  {row.attempts > 1 && (
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {t("attempts", { attempts: row.attempts, max: MAX_EMAIL_ATTEMPTS })}
                    </span>
                  )}
                </p>
                <p className="text-[12.5px] break-words">{row.subject}</p>
                <p className="mt-0.5 font-mono text-[11px] break-all text-text-2">{row.to}</p>
                {row.lastError && (
                  <p className="mt-1 text-[11.5px] break-words text-status-rejected-tx">
                    {row.lastError}
                  </p>
                )}
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {[
                    format.dateTime(row.createdAt, { dateStyle: "medium", timeStyle: "short" }),
                    row.sentAt
                      ? `${t("fields.sent")}: ${format.dateTime(row.sentAt, { timeStyle: "short" })}`
                      : "",
                    row.nextRetryAt
                      ? t("retryAt", {
                          time: format.dateTime(row.nextRetryAt, { timeStyle: "short" }),
                        })
                      : "",
                    row.entityId ?? "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {row.status === "FAILED" && <ResendEmailButton id={row.id} />}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 overflow-hidden rounded-[15px] border">
        <Pager
          info={t("pageInfo", { from, to, total: data.total })}
          page={query.page}
          pageCount={data.pageCount}
          hrefFor={(page) => buildHref("/staff/email-logs", baseParams, page)}
          previousLabel={tc("previous")}
          nextLabel={tc("nextPage")}
        />
      </div>
    </div>
  );
}
