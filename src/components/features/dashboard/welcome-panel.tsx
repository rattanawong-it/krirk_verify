import { getLocale, getTranslations } from "next-intl/server";
import { Icon } from "@/components/ui/icon";
import type { SessionUser } from "@/lib/services/auth.service";
import { cn } from "@/lib/utils";

const ORG_STATUS_STYLE = {
  PENDING: "bg-status-pending-bg text-status-pending-tx",
  APPROVED: "bg-status-approved-bg text-status-approved-tx",
  SUSPENDED: "bg-status-rejected-bg text-status-rejected-tx",
} as const;

// หน้าหลักชั่วคราว — สรุปคำขอ/สถิติจริงจะมาใน Phase 3 (portal) และ Phase 6 (staff)
export async function WelcomePanel({ user }: { user: SessionUser }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const org = user.organization;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="relative overflow-hidden rounded-2xl bg-hero p-6 text-white sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/6"
        />
        <p className="text-xs font-semibold text-white/70">{t(`common.roles.${user.role}`)}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">
          {t("shell.welcome", { name: user.name })}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
          {t("shell.dashboardPlaceholder")}
        </p>
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <Icon name="userCircle" size={20} className="text-primary" />
          {t("shell.accountInfo")}
        </h2>
        <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
          <div className="bg-card p-4">
            <dt className="text-xs text-muted-foreground">{t("account.email")}</dt>
            <dd className="mt-1 text-sm font-semibold break-all">{user.email}</dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-xs text-muted-foreground">{t("account.role")}</dt>
            <dd className="mt-1 text-sm font-semibold">{t(`common.roles.${user.role}`)}</dd>
          </div>
          {org && (
            <div className="bg-card p-4 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{t("account.organization")}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold">
                {locale === "en" ? (org.nameEn ?? org.nameTh) : org.nameTh}
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                    ORG_STATUS_STYLE[org.status],
                  )}
                >
                  {t(`account.orgStatus.${org.status}`)}
                </span>
              </dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
