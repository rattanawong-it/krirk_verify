import Image from "next/image";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { isStaffRole } from "@/lib/auth/rbac";
import {
  NOTIFICATION_FALLBACK_HREF,
  NOTIFICATION_STYLE,
  notificationValues,
} from "@/lib/notifications/display";
import { getBellState } from "@/lib/services/notification.service";
import { getVerificationQuota } from "@/lib/services/rate-limit.service";
import type { SessionUser } from "@/lib/services/auth.service";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { navItemsFor } from "./nav-config";
import { NotificationBell } from "./notification-bell";
import { MobileBottomNav, type ShellNavItem, SidebarNav } from "./shell-nav";
import { UserMenu } from "./user-menu";

// App shell ตาม project-ui/2 (portal) และ 3 (staff): sidebar ไล่เฉดบนเดสก์ท็อป · bottom nav บนมือถือ
export async function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const staff = isStaffRole(user.role);
  const areaLabel = staff ? t("shell.staffLabel") : t("shell.portalLabel");
  // ตัวบอกโควตาในเมนูข้างของผู้ขอ — ถ้าอ่านไม่ได้ก็ซ่อน ไม่ให้ทั้งหน้าล้ม
  const quota = staff ? null : await getVerificationQuota(user.id).catch(() => null);
  const quotaPercent = quota ? Math.round((quota.used / quota.limit) * 100) : 0;

  // F-NOT-05 — กระดิ่งแจ้งเตือน · อ่านไม่ได้ก็แสดงกระดิ่งเปล่า ไม่ให้ทั้งหน้าล้ม
  const format = await getFormatter();
  const bell = await getBellState(user.id).catch(() => ({ rows: [], unread: 0 }));
  const bellItems = bell.rows.map((row) => {
    const values = notificationValues(row.params);
    return {
      id: row.id,
      href: row.href ?? NOTIFICATION_FALLBACK_HREF,
      title: t(`notifications.types.${row.type}.title` as never, values as never),
      body: t(`notifications.types.${row.type}.body` as never, values as never),
      time: format.dateTime(row.createdAt, { dateStyle: "short", timeStyle: "short" }),
      unread: row.readAt === null,
      ...NOTIFICATION_STYLE[row.type],
    };
  });

  const items: ShellNavItem[] = navItemsFor(user.role).map((item) => ({
    href: item.href,
    label: t(`shell.nav.${item.labelKey}`),
    icon: item.icon,
    available: item.available,
  }));
  const orgName = user.organization
    ? locale === "en"
      ? (user.organization.nameEn ?? user.organization.nameTh)
      : user.organization.nameTh
    : null;

  return (
    <div className="flex min-h-dvh flex-1">
      {/* F-UX-10 — ข้ามเมนูไปยังเนื้อหาด้วยคีย์บอร์ด */}
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("common.skipToContent")}
      </a>
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col gap-1 bg-[linear-gradient(180deg,#16431a,#0e3a13)] px-3 py-4.5 lg:flex dark:bg-[linear-gradient(180deg,#132a12,#0b1109)] print:hidden">
        <Link href={items[0]?.href ?? "/"} className="mb-3 block px-2 pt-1">
          <Image
            src="/brand/kru-logo-white.png"
            alt={t("common.university")}
            width={116}
            height={20}
            className="mb-2 h-5 w-auto"
          />
          <span className="block text-[13px] font-bold text-white">Krirk Verify</span>
          <span className="block text-[10px] text-white/55">{areaLabel}</span>
        </Link>
        <SidebarNav items={items} comingSoon={t("shell.comingSoon")} label={t("shell.mainNav")} />
        {quota && (
          <div className="mt-auto rounded-xl border border-white/14 bg-white/8 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-white/70">
                {t("verify.quota.title")}
              </span>
              <span className="font-mono text-[10.5px] text-white">
                {quota.used} / {quota.limit}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={t("verify.quota.title")}
              aria-valuemin={0}
              aria-valuemax={quota.limit}
              aria-valuenow={quota.used}
              className="h-[5px] overflow-hidden rounded bg-white/16"
            >
              <div className="h-full rounded bg-[#38ae36]" style={{ width: `${quotaPercent}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-white/55">
              {t("verify.quota.note")}
            </p>
          </div>
        )}
        {orgName && (
          <div
            className={`${quota ? "mt-2" : "mt-auto"} rounded-xl border border-white/14 bg-white/8 p-3`}
          >
            <p className="text-[10.5px] font-semibold text-white/60">{t("account.organization")}</p>
            <p className="mt-1 line-clamp-2 text-xs font-semibold text-white">{orgName}</p>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <header className="sticky top-0 z-30 flex h-[58px] shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6 print:hidden">
          <Link href={items[0]?.href ?? "/"} className="lg:hidden">
            <Image
              src="/brand/kru-logo.png"
              alt={t("common.university")}
              width={110}
              height={20}
              className="h-5 w-auto dark:hidden"
            />
            <Image
              src="/brand/kru-logo-white.png"
              alt={t("common.university")}
              width={110}
              height={20}
              className="hidden h-5 w-auto dark:block"
            />
          </Link>
          <span className="hidden text-xs text-muted-foreground lg:inline">{areaLabel}</span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher />
            <NotificationBell
              items={bellItems}
              unread={bell.unread}
              labels={{
                title: t("notifications.title"),
                unreadCount: t("notifications.unreadCount", { count: bell.unread }),
                markAll: t("notifications.markAll"),
                seeAll: t("notifications.seeAll"),
                empty: t("notifications.empty"),
                bell: t("notifications.bell"),
              }}
            />
            <UserMenu
              name={user.name}
              email={user.email}
              role={user.role}
              roleLabel={t(`common.roles.${user.role}`)}
              labels={{
                profile: t("shell.nav.profile"),
                logout: t("common.logout"),
                theme: t("common.theme"),
              }}
            />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-5 pb-24 outline-none sm:px-6 lg:pb-8 print:p-0"
        >
          {children}
        </main>
      </div>

      <MobileBottomNav
        items={items}
        labels={{
          nav: t("shell.mainNav"),
          menu: t("shell.menu"),
          openMenu: t("shell.openMenu"),
          closeMenu: t("shell.closeMenu"),
          comingSoon: t("shell.comingSoon"),
        }}
      />
    </div>
  );
}
