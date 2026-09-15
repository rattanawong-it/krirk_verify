import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { OrgActionButtons } from "@/components/features/staff/org-action-buttons";
import { orgActionLabels } from "@/components/features/staff/org-labels";
import { ORG_STATUS_TONE, StatusPill } from "@/components/features/staff/status-pill";
import { RequestStatusBadge } from "@/components/features/verification/request-status-badge";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import { getOrganizationDetail } from "@/lib/services/organization.service";

// F-REG-08 — ประวัติการใช้งานของหน่วยงาน: ผู้ใช้ คำขอล่าสุด และประวัติการเปลี่ยนสถานะ

const REQUEST_STATUSES = ["APPROVED", "PENDING_REVIEW", "REJECTED", "NOT_FOUND"] as const;

const EVENT_KEYS: Record<
  string,
  "approved" | "rejected" | "suspended" | "restored" | "registered"
> = {
  "organization.approved": "approved",
  "organization.rejected": "rejected",
  "organization.suspended": "suspended",
  "organization.restored": "restored",
  "auth.register.organization": "registered",
};

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/organizations/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "orgs" });
  return { title: t("actions.history") };
}

export default async function OrganizationDetailPage({
  params,
}: PageProps<"/[locale]/staff/organizations/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(STAFF_ROLES);

  const org = await getOrganizationDetail(id);
  if (!org) notFound();

  const currentLocale = await getLocale();
  const orgName = currentLocale === "en" ? (org.nameEn ?? org.nameTh) : org.nameTh;
  const [t, ta, tv, format, labels] = await Promise.all([
    getTranslations("orgs"),
    getTranslations("auth.registerOrg"),
    getTranslations("verify"),
    getFormatter(),
    orgActionLabels(orgName),
  ]);
  const dateTime = (value: Date | null) =>
    value ? format.dateTime(value, { dateStyle: "medium", timeStyle: "short" }) : t("none");

  const info = [
    { label: t("taxId"), value: org.taxId, mono: true },
    { label: t("type"), value: ta(`orgTypes.${org.orgType}`) },
    { label: t("address"), value: org.address },
    { label: t("contactEmail"), value: org.contactEmail },
    { label: t("phone"), value: org.phone },
    { label: t("registeredAt"), value: dateTime(org.createdAt) },
    { label: t("approvedAt"), value: dateTime(org.approvedAt) },
    ...(org.status === "SUSPENDED" && org.statusReason
      ? [{ label: t("statusReason"), value: org.statusReason }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={{ pathname: "/staff/organizations", query: { status: org.status } }}
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-text-2 hover:text-foreground sm:min-h-0"
      >
        <Icon name="arrowLeft" size={16} />
        {t("backToList")}
      </Link>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{orgName}</h1>
          <div className="mt-2">
            <StatusPill tone={ORG_STATUS_TONE[org.status]} label={t(`statuses.${org.status}`)} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[360px]">
          <OrgActionButtons organizationId={org.id} actions={org.actions} labels={labels} />
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="rounded-[15px] border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-[14px] font-bold">{t("info")}</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {info.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
                  <dd
                    className={`mt-0.5 text-[13px] font-semibold break-words ${"mono" in row && row.mono ? "font-mono" : ""}`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="overflow-hidden rounded-[15px] border bg-card">
            <h2 className="border-b px-4.5 py-3 text-[14px] font-bold">{t("users")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[12.5px]">
                <thead className="border-b bg-surface text-[11px] font-bold text-text-2">
                  <tr>
                    <th scope="col" className="px-4.5 py-2.5">
                      {t("userColumns.name")}
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      {t("userColumns.email")}
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      {t("userColumns.status")}
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      {t("userColumns.lastLogin")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {org.users.map((user) => (
                    <tr key={user.id} className="border-b last:border-b-0">
                      <td className="px-4.5 py-2.5 font-semibold">
                        {user.name}
                        {user.position && (
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {user.position}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 break-all">{user.email}</td>
                      <td className="px-3 py-2.5">{t(`userStatuses.${user.status}`)}</td>
                      <td className="px-3 py-2.5 text-text-2">{dateTime(user.lastLoginAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-[15px] border bg-card">
            <h2 className="border-b px-4.5 py-3 text-[14px] font-bold">{t("recentRequests")}</h2>
            {org.requests.length === 0 ? (
              <p className="px-4.5 py-8 text-center text-xs text-muted-foreground">
                {t("noRequests")}
              </p>
            ) : (
              <ul className="flex flex-col gap-px bg-border">
                {org.requests.map((request) => (
                  <li key={request.refNo}>
                    <Link
                      href={`/staff/queue/${request.refNo}`}
                      className="flex flex-col gap-1 bg-card px-4.5 py-3 hover:bg-surface sm:flex-row sm:items-center sm:gap-3"
                    >
                      <span className="font-mono text-[12px] font-medium text-primary sm:w-[150px]">
                        {request.refNo}
                      </span>
                      <span className="flex-1 text-[12px] text-text-2">
                        {tv(`purposes.${request.purpose}`)} · {request.requester.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <RequestStatusBadge
                          status={request.status}
                          label={tv(`statuses.${request.status}`)}
                          compact
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {dateTime(request.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:flex-none">
          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-3 text-[13.5px] font-bold">{t("requestSummary")}</h2>
            <dl className="flex flex-col gap-2.5 text-xs">
              {REQUEST_STATUSES.map((status) => (
                <div key={status} className="flex items-center justify-between gap-3">
                  <dt>
                    <RequestStatusBadge status={status} label={tv(`statuses.${status}`)} compact />
                  </dt>
                  <dd className="font-mono text-[13px] font-bold">
                    {org.statusCounts[status] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-3 text-[13.5px] font-bold">{t("history")}</h2>
            {org.history.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noHistory")}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {org.history.map((event) => {
                  const meta = (event.metadata ?? {}) as { reason?: string | null };
                  const key = EVENT_KEYS[event.action];
                  return (
                    <li key={event.id} className="border-l-2 border-border pl-3">
                      <p className="text-[12.5px] font-bold">
                        {key ? t(`events.${key}`) : t("events.other")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {event.actor?.name ?? t("none")} · {dateTime(event.createdAt)}
                      </p>
                      {meta.reason && (
                        <p className="mt-1 text-[11.5px] text-text-2">{meta.reason}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
