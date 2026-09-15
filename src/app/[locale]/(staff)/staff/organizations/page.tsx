import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { OrgActionButtons } from "@/components/features/staff/org-action-buttons";
import { orgActionLabels } from "@/components/features/staff/org-labels";
import { Pager, buildHref } from "@/components/features/staff/pager";
import { ORG_STATUS_TONE, StatusPill } from "@/components/features/staff/status-pill";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import {
  ORG_PAGE_SIZE,
  type OrganizationRow,
  listOrganizations,
} from "@/lib/services/organization.service";
import { cn } from "@/lib/utils";
import { organizationQuerySchema } from "@/lib/validations/review";

// F-REG-08 — จัดการหน่วยงานภายนอก (ตาม project-ui/3 · หน่วยงาน)

const STATUSES = ["PENDING", "APPROVED", "SUSPENDED"] as const;

const ICON_TONE = {
  PENDING: "bg-status-pending-bg text-status-pending",
  APPROVED: "bg-primary-soft text-primary",
  SUSPENDED: "bg-status-rejected-bg text-status-rejected",
} as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/organizations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "orgs" });
  return { title: t("title") };
}

export default async function OrganizationsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/organizations">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(STAFF_ROLES);

  const query = organizationQuerySchema.parse(await searchParams);
  const [data, t, ta, tv, format, currentLocale] = await Promise.all([
    listOrganizations(query.status, query.page),
    getTranslations("orgs"),
    getTranslations("auth.registerOrg"),
    getTranslations("verify"),
    getFormatter(),
    getLocale(),
  ]);

  const date = (value: Date | null) =>
    value ? format.dateTime(value, { dateStyle: "medium" }) : "—";
  const nameOf = (org: OrganizationRow) =>
    currentLocale === "en" ? (org.nameEn ?? org.nameTh) : org.nameTh;
  const maskTaxId = (taxId: string) =>
    `${taxId.slice(0, 7)}${"x".repeat(Math.max(0, taxId.length - 7))}`;

  const cards = await Promise.all(
    data.rows.map(async (org) => {
      const email = org.contact?.email ?? org.contactEmail;
      const meta =
        org.status === "PENDING"
          ? t("metaPending", { taxId: maskTaxId(org.taxId), date: date(org.createdAt), email })
          : org.status === "APPROVED"
            ? t("metaApproved", {
                type: ta(`orgTypes.${org.orgType}`),
                date: date(org.approvedAt),
                email,
              })
            : t("metaSuspended", {
                date: date(org.suspendedAt),
                reason: org.statusReason ?? t("none"),
              });
      const stats =
        org.status === "PENDING"
          ? [
              { label: t("stats.contact"), value: org.contact?.name ?? t("none") },
              {
                label: t("stats.emailDomain"),
                value: email.split("@")[1] ?? t("none"),
                mono: true,
              },
              { label: t("stats.requests"), value: String(org.requestCount), mono: true },
              {
                label: t("stats.emailVerified"),
                value: org.contact?.emailVerifiedAt ? t("yes") : t("no"),
              },
            ]
          : [
              { label: t("stats.users"), value: String(org.userCount), mono: true },
              { label: t("stats.requests30d"), value: String(org.requests30d), mono: true },
              org.status === "APPROVED"
                ? {
                    label: t("stats.approvedRate"),
                    value: org.approvedRate === null ? t("none") : `${org.approvedRate}%`,
                    mono: true,
                  }
                : { label: t("stats.suspendedBy"), value: org.suspendedByName ?? t("none") },
              { label: t("stats.lastActivity"), value: date(org.lastRequestAt) },
            ];
      return { org, meta, stats, labels: await orgActionLabels(nameOf(org)) };
    }),
  );

  const from = data.total === 0 ? 0 : (query.page - 1) * ORG_PAGE_SIZE + 1;
  const to = Math.min(query.page * ORG_PAGE_SIZE, data.total);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("subtitle")}</p>
        </div>
        <nav className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {STATUSES.map((status) => (
            <Link
              key={status}
              href={buildHref("/staff/organizations", { status }, 1)}
              aria-current={query.status === status ? "page" : undefined}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold whitespace-nowrap sm:h-9",
                query.status === status
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-text-2 hover:bg-surface",
              )}
            >
              {t(`statuses.${status}`)}
              <span className="font-mono text-[11px] opacity-80">{data.counts[status]}</span>
            </Link>
          ))}
        </nav>
      </div>

      {cards.length === 0 ? (
        <p className="rounded-[15px] border bg-card px-4.5 py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map(({ org, meta, stats, labels }) => (
            <li
              key={org.id}
              className={cn(
                "flex flex-col gap-4 rounded-[15px] border bg-card p-4 sm:p-4.5 lg:flex-row lg:items-start",
                org.status === "PENDING" && "border-status-pending/40",
                org.status === "SUSPENDED" && "border-status-rejected/35",
              )}
            >
              <span
                className={cn(
                  "hidden size-12 shrink-0 items-center justify-center rounded-[13px] sm:flex",
                  ICON_TONE[org.status],
                )}
              >
                <Icon name="building" size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-[15.5px] font-bold">{nameOf(org)}</h2>
                  <StatusPill
                    tone={ORG_STATUS_TONE[org.status]}
                    label={t(`statuses.${org.status}`)}
                  />
                </div>
                <p className="mb-3 text-xs break-words text-muted-foreground">{meta}</p>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="min-w-0">
                      <dt className="text-[10.5px] text-muted-foreground">{stat.label}</dt>
                      <dd
                        className={cn(
                          "mt-px truncate text-[13px] font-semibold",
                          "mono" in stat && stat.mono && "font-mono",
                        )}
                      >
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:w-[170px] lg:shrink-0 lg:grid-cols-1">
                <OrgActionButtons organizationId={org.id} actions={org.actions} labels={labels} />
                <Button asChild variant="outline" className="h-11 w-full font-semibold sm:h-9">
                  <Link href={`/staff/organizations/${org.id}`}>
                    <Icon name="history" size={16} />
                    {t("actions.history")}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.pageCount > 1 && (
        <div className="mt-3 overflow-hidden rounded-[15px] border">
          <Pager
            info={t("pageInfo", { from, to, total: data.total })}
            page={query.page}
            pageCount={data.pageCount}
            hrefFor={(page) => buildHref("/staff/organizations", { status: query.status }, page)}
            previousLabel={tv("list.previous")}
            nextLabel={tv("list.next")}
          />
        </div>
      )}
    </div>
  );
}
