import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import {
  CreateUserButton,
  type ManagedUser,
  UserRowActions,
} from "@/components/features/admin/user-dialogs";
import { Pager, buildHref } from "@/components/features/staff/pager";
import { StatusPill, type StatusTone } from "@/components/features/staff/status-pill";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { USER_PAGE_SIZE, type UserRow, listUsers } from "@/lib/services/user-admin.service";
import { cn } from "@/lib/utils";
import { USER_ROLES, USER_STATUSES, userQuerySchema } from "@/lib/validations/admin";

// F-AUD-05 — จัดการผู้ใช้ระบบ (ตาม project-ui/4 · ผู้ใช้ระบบ)

const ROLE_STYLE: Record<(typeof USER_ROLES)[number], { tone: string; icon: IconName }> = {
  ADMIN: { tone: "bg-status-notfound-bg text-status-notfound-tx", icon: "shield" },
  REGISTRAR: { tone: "bg-status-approved-bg text-status-approved-tx", icon: "shieldCheck" },
  EXTERNAL: { tone: "bg-status-info-bg text-status-info-tx", icon: "building" },
  ALUMNI: { tone: "bg-status-pending-bg text-status-pending-tx", icon: "graduation" },
};

const STATUS_TONE: Record<"PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "LOCKED", StatusTone> =
  {
    PENDING_VERIFICATION: "pending",
    ACTIVE: "approved",
    SUSPENDED: "expired",
    LOCKED: "rejected",
  };

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/users">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "users" });
  return { title: t("title") };
}

export default async function UsersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/users">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const admin = await requireRole(["ADMIN"]);

  const query = userQuerySchema.parse(await searchParams);
  const [data, t, tr, format, currentLocale] = await Promise.all([
    listUsers(query),
    getTranslations("users"),
    getTranslations("common.roles"),
    getFormatter(),
    getLocale(),
  ]);

  const now = new Date();
  const baseParams = { q: query.q, role: query.role, status: query.status };
  const from = data.total === 0 ? 0 : (query.page - 1) * USER_PAGE_SIZE + 1;
  const to = Math.min(query.page * USER_PAGE_SIZE, data.total);
  const fieldClass =
    "h-11 rounded-[9px] border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 lg:h-9";

  const view = (row: UserRow) => {
    const locked = !!row.lockedUntil && row.lockedUntil > now;
    const status: keyof typeof STATUS_TONE =
      locked && row.status !== "SUSPENDED" ? "LOCKED" : row.status;
    const affiliation = row.organization
      ? currentLocale === "en"
        ? (row.organization.nameEn ?? row.organization.nameTh)
        : row.organization.nameTh
      : (row.student?.studentCode ?? "—");
    const managed: ManagedUser = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      position: row.position,
      phone: row.phone,
      locked,
      isSelf: row.id === admin.id,
    };
    return {
      status,
      affiliation,
      managed,
      lastLogin: row.lastLoginAt
        ? format.dateTime(row.lastLoginAt, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : t("never"),
    };
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("subtitle")}</p>
        </div>
        <CreateUserButton />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {USER_ROLES.map((role) => (
          <Link
            key={role}
            href={buildHref("/staff/users", { role }, 1)}
            aria-current={query.role === role ? "page" : undefined}
            className={cn(
              "rounded-[14px] border bg-card p-3.5 hover:bg-surface sm:p-4",
              query.role === role && "border-primary ring-2 ring-primary/15",
            )}
          >
            <span className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-[9px]",
                  ROLE_STYLE[role].tone,
                )}
              >
                <Icon name={ROLE_STYLE[role].icon} size={16} />
              </span>
              <span className="font-mono text-[10.5px] font-medium text-muted-foreground">
                {role}
              </span>
            </span>
            <span className="block text-[22px] font-bold tabular-nums">
              {format.number(data.roleCounts[role])}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {t(`roleCounts.${role}`)}
            </span>
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-[15px] border bg-card">
        <form
          role="search"
          className="grid gap-2 border-b p-3.5 sm:grid-cols-2 sm:px-4.5 lg:flex lg:items-center"
        >
          <div className="relative sm:col-span-2 lg:flex-1">
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
            name="role"
            defaultValue={query.role ?? ""}
            aria-label={t("columns.role")}
            className={fieldClass}
          >
            <option value="">{t("allRoles")}</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {tr(role)}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={query.status ?? ""}
            aria-label={t("columns.status")}
            className={fieldClass}
          >
            <option value="">{t("allStatuses")}</option>
            {USER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`statuses.${status}`)}
              </option>
            ))}
          </select>
          <Button type="submit" className="h-11 font-semibold lg:h-9">
            {t("search")}
          </Button>
        </form>

        {data.rows.length === 0 ? (
          <p className="px-4.5 py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[12.5px]">
                <thead className="border-b bg-surface text-[11.5px] font-bold text-text-2">
                  <tr>
                    <th scope="col" className="px-4.5 py-2.5 font-bold">
                      {t("columns.user")}
                    </th>
                    <th scope="col" className="w-[130px] px-3 py-2.5 font-bold">
                      {t("columns.role")}
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-bold">
                      {t("columns.org")}
                    </th>
                    <th scope="col" className="w-[130px] px-3 py-2.5 font-bold">
                      {t("columns.status")}
                    </th>
                    <th scope="col" className="w-[130px] px-3 py-2.5 font-bold">
                      {t("columns.lastLogin")}
                    </th>
                    <th scope="col" className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const v = view(row);
                    return (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="max-w-0 px-4.5 py-2.5">
                          <p className="truncate font-semibold">
                            {row.name}
                            {v.managed.isSelf && (
                              <span className="ml-1.5 text-[10.5px] font-normal text-primary">
                                ({t("you")})
                              </span>
                            )}
                          </p>
                          <p className="truncate text-[10.5px] text-muted-foreground">
                            {row.email}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 font-mono text-[10.5px] font-medium",
                              ROLE_STYLE[row.role].tone,
                            )}
                          >
                            {row.role}
                          </span>
                        </td>
                        <td className="max-w-0 truncate px-3 py-2.5 text-text-2">
                          {v.affiliation}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill
                            tone={STATUS_TONE[v.status]}
                            label={t(`statuses.${v.status}`)}
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-text-2">
                          {v.lastLogin}
                        </td>
                        <td className="pr-3 text-right">
                          <UserRowActions user={v.managed} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-px bg-border md:hidden">
              {data.rows.map((row) => {
                const v = view(row);
                return (
                  <li key={row.id} className="flex items-start gap-2 bg-card px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 font-mono text-[10px] font-medium",
                            ROLE_STYLE[row.role].tone,
                          )}
                        >
                          {row.role}
                        </span>
                        <StatusPill
                          tone={STATUS_TONE[v.status]}
                          label={t(`statuses.${v.status}`)}
                          compact
                        />
                      </p>
                      <p className="truncate text-[13px] font-semibold">{row.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{row.email}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {v.affiliation} · {v.lastLogin}
                      </p>
                    </div>
                    <UserRowActions user={v.managed} />
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <Pager
          info={t("pageInfo", { from, to, total: data.total })}
          page={query.page}
          pageCount={data.pageCount}
          hrefFor={(page) => buildHref("/staff/users", baseParams, page)}
          previousLabel="←"
          nextLabel="→"
        />
      </section>
    </div>
  );
}
