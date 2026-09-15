import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AuditDetailButton } from "@/components/features/admin/audit-detail-button";
import { Pager, buildHref } from "@/components/features/staff/pager";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { maskIp } from "@/lib/email/templates";
import {
  AUDIT_PAGE_SIZE,
  type AuditRow,
  KNOWN_AUDIT_ACTIONS,
  listAuditLogs,
} from "@/lib/services/audit-log.service";
import { cn } from "@/lib/utils";
import { AUDIT_RANGES, auditQuerySchema } from "@/lib/validations/admin";

// F-AUD-03 / F-AUD-04 — Audit Log (ตาม project-ui/4 · Audit Log)

type Kind = "fail" | "reveal" | "approve" | "reject" | "admin" | "auth" | "view" | "other";

const KIND_STYLE: Record<Kind, { icon: IconName; box: string; tag: string; edge: string }> = {
  fail: {
    icon: "alert",
    box: "bg-status-rejected-bg text-status-rejected",
    tag: "bg-status-rejected-bg text-status-rejected-tx",
    edge: "border-l-status-rejected",
  },
  reveal: {
    icon: "lock",
    box: "bg-status-pending-bg text-status-pending",
    tag: "bg-status-pending-bg text-status-pending-tx",
    edge: "border-l-status-pending",
  },
  approve: {
    icon: "checkCircle",
    box: "bg-primary-soft text-primary",
    tag: "bg-status-approved-bg text-status-approved-tx",
    edge: "border-l-transparent",
  },
  reject: {
    icon: "xCircle",
    box: "bg-status-rejected-bg text-status-rejected",
    tag: "bg-status-rejected-bg text-status-rejected-tx",
    edge: "border-l-transparent",
  },
  admin: {
    icon: "settings",
    box: "bg-status-notfound-bg text-status-notfound",
    tag: "bg-status-notfound-bg text-status-notfound-tx",
    edge: "border-l-status-notfound",
  },
  auth: {
    icon: "login",
    box: "bg-status-info-bg text-status-info",
    tag: "bg-status-info-bg text-status-info-tx",
    edge: "border-l-transparent",
  },
  view: {
    icon: "eye",
    box: "bg-primary-soft text-primary",
    tag: "bg-status-approved-bg text-status-approved-tx",
    edge: "border-l-transparent",
  },
  other: {
    icon: "circle",
    box: "bg-muted text-muted-foreground",
    tag: "bg-muted text-muted-foreground",
    edge: "border-l-transparent",
  },
};

const FAIL = new Set([
  "auth.login.failed",
  "auth.account.locked",
  "auth.register.alumni.not_matched",
  "verification.rate_limited",
  "verification.permalink.denied",
  "sync.failed",
]);
const APPROVE = new Set([
  "verification.approved",
  "organization.approved",
  "organization.restored",
  "user.activated",
]);
const REJECT = new Set([
  "verification.rejected",
  "organization.rejected",
  "organization.suspended",
  "user.suspended",
]);

function kindOf(action: string): Kind {
  if (FAIL.has(action)) return "fail";
  if (action === "personal_data.revealed") return "reveal";
  if (APPROVE.has(action)) return "approve";
  if (REJECT.has(action)) return "reject";
  if (
    action.startsWith("settings.") ||
    action.startsWith("retention.") ||
    action.startsWith("audit.") ||
    (action.startsWith("user.") && action !== "user.profile.updated")
  ) {
    return "admin";
  }
  if (action.startsWith("auth.")) return "auth";
  if (action.endsWith(".viewed") || action === "student.searched") return "view";
  return "other";
}

// สรุปสั้นจาก metadata ที่พบบ่อย (ไม่แสดงค่าที่ไม่รู้จัก — ดูเต็มในกล่องรายละเอียด)
function summaryOf(row: AuditRow): string {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["refNo", "studentCode", "email", "type", "reason", "status", "field"]) {
    const value = meta[key];
    if (typeof value === "string" || typeof value === "number") parts.push(`${key}: ${value}`);
  }
  if (typeof meta.from === "string" && typeof meta.to === "string")
    parts.push(`${meta.from} → ${meta.to}`);
  if (Array.isArray(meta.changes))
    parts.push(meta.changes.map((c) => (c as { key?: string }).key).join(", "));
  if (row.entityType && !meta.refNo && !meta.studentCode)
    parts.push(`${row.entityType}${row.entityId ? ` ${row.entityId}` : ""}`);
  return parts.join(" · ");
}

function browserOf(userAgent: string | null): string {
  const match = userAgent?.match(/(Edg|OPR|Chrome|Firefox|Safari)\/(\d+)/);
  if (!match) return "";
  const name = { Edg: "Edge", OPR: "Opera" }[match[1]!] ?? match[1];
  return `${name} ${match[2]}`;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/audit-logs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "audit" });
  return { title: t("title") };
}

export default async function AuditLogsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/audit-logs">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(["ADMIN"]);

  const query = auditQuerySchema.parse(await searchParams);
  const [data, t, format] = await Promise.all([
    listAuditLogs(query),
    getTranslations("audit"),
    getFormatter(),
  ]);

  const tc = await getTranslations("common");
  const label = (action: string) => {
    const key = `actions.${action.replaceAll(".", "_")}`;
    return t.has(key as never) ? t(key as never) : action;
  };
  const baseParams = {
    q: query.q,
    action: query.action,
    range: query.range === "7d" ? undefined : query.range,
    from: query.from,
    to: query.to,
  };
  const exportParams = new URLSearchParams(
    Object.entries({ ...baseParams, range: query.range }).filter(
      (e): e is [string, string] => !!e[1],
    ),
  );
  const from = data.total === 0 ? 0 : (query.page - 1) * AUDIT_PAGE_SIZE + 1;
  const to = Math.min(query.page * AUDIT_PAGE_SIZE, data.total);
  const fieldClass =
    "h-11 rounded-[9px] border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 lg:h-9";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild variant="outline" className="h-11 font-semibold sm:h-[38px]">
          <a href={`/api/staff/audit-logs/export?${exportParams}`} download>
            <Icon name="download" size={16} />
            {t("exportCsv")}
          </a>
        </Button>
      </div>

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
          name="action"
          defaultValue={query.action ?? ""}
          aria-label={t("fields.action")}
          className={fieldClass}
        >
          <option value="">{t("allActions")}</option>
          {KNOWN_AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {label(action)}
            </option>
          ))}
        </select>
        <select
          name="range"
          defaultValue={query.range}
          aria-label={t("ranges.7d")}
          className={fieldClass}
        >
          {AUDIT_RANGES.map((range) => (
            <option key={range} value={range}>
              {t(`ranges.${range}`)}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
          {t("from")}
          <input type="date" name="from" defaultValue={query.from} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted-foreground">
          {t("to")}
          <input type="date" name="to" defaultValue={query.to} className={fieldClass} />
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" variant="outline" className="h-11 flex-1 font-semibold lg:h-9">
            <Icon name="filter" size={14} />
            {t("apply")}
          </Button>
          <Button asChild variant="ghost" className="h-11 flex-1 font-semibold lg:h-9">
            <Link href="/staff/audit-logs">{t("clear")}</Link>
          </Button>
        </div>
      </form>
      <p className="mb-3 text-[11.5px] text-muted-foreground">{t("exportNote")}</p>

      {data.rows.length === 0 ? (
        <p className="rounded-[15px] border bg-card px-4.5 py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.rows.map((row) => {
            const style = KIND_STYLE[kindOf(row.action)];
            const time = format.dateTime(row.createdAt, {
              dateStyle: "medium",
              timeStyle: "medium",
            });
            const actor = row.actor ? `${row.actor.name} · ${row.actor.email}` : t("anonymous");
            const summary = summaryOf(row);
            return (
              <li
                key={row.id}
                className={cn(
                  "flex flex-col gap-3 rounded-[13px] border border-l-[3px] bg-card p-3.5 sm:flex-row sm:items-start sm:gap-3.5 sm:px-4",
                  style.edge,
                )}
              >
                <span
                  className={cn(
                    "hidden size-[38px] shrink-0 items-center justify-center rounded-[11px] sm:flex",
                    style.box,
                  )}
                >
                  <Icon name={style.icon} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 font-mono text-[11px] font-medium",
                        style.tag,
                      )}
                    >
                      {row.action}
                    </span>
                    <span className="text-[12.5px] font-semibold">{label(row.action)}</span>
                  </p>
                  <p className="text-[12px] break-words text-text-2">
                    {row.actor ? (
                      <>
                        <span className="font-semibold">{row.actor.name}</span>{" "}
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          {row.actor.role}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{t("anonymous")}</span>
                    )}
                    {summary && (
                      <span className="block break-all text-muted-foreground">{summary}</span>
                    )}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {[maskIp(row.ipAddress), browserOf(row.userAgent), time]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <AuditDetailButton
                  detail={{
                    title: label(row.action),
                    action: row.action,
                    time,
                    actor,
                    entity: row.entityType ? `${row.entityType} ${row.entityId ?? ""}`.trim() : "—",
                    ip: row.ipAddress ?? "—",
                    userAgent: row.userAgent ?? "—",
                    metadata: row.metadata ? JSON.stringify(row.metadata, null, 2) : "—",
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 overflow-hidden rounded-[15px] border">
        <Pager
          info={t("pageInfo", { from, to, total: data.total })}
          page={query.page}
          pageCount={data.pageCount}
          hrefFor={(page) => buildHref("/staff/audit-logs", baseParams, page)}
          previousLabel={tc("previous")}
          nextLabel={tc("nextPage")}
        />
      </div>
    </div>
  );
}
