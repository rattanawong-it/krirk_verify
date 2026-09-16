import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { markAllNotificationsReadAction } from "@/actions/notifications";
import { Pager, buildHref } from "@/components/features/staff/pager";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAuth } from "@/lib/auth/guards";
import {
  NOTIFICATION_FALLBACK_HREF,
  NOTIFICATION_STYLE,
  notificationValues,
} from "@/lib/notifications/display";
import { NOTIFICATION_PAGE_SIZE, listNotifications } from "@/lib/services/notification.service";
import { cn } from "@/lib/utils";

// F-NOT-05 — รายการแจ้งเตือนทั้งหมดของผู้ใช้ (ปลายทางของ "ดูการแจ้งเตือนทั้งหมด" ในกระดิ่ง)

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/notifications">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "notifications" });
  return { title: t("title") };
}

export default async function NotificationsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const user = await requireAuth();

  const raw = (await searchParams).page;
  const page = Math.min(10_000, Math.max(1, Number(Array.isArray(raw) ? raw[0] : raw) || 1));
  const [data, t, tc, format] = await Promise.all([
    listNotifications(user.id, page),
    getTranslations("notifications"),
    getTranslations("common"),
    getFormatter(),
  ]);

  const unread = data.rows.filter((row) => row.readAt === null).length;
  const from = data.total === 0 ? 0 : (page - 1) * NOTIFICATION_PAGE_SIZE + 1;
  const to = Math.min(page * NOTIFICATION_PAGE_SIZE, data.total);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("subtitle")}</p>
        </div>
        {unread > 0 && (
          <form
            action={async () => {
              "use server";
              await markAllNotificationsReadAction();
            }}
          >
            <Button type="submit" variant="outline" className="h-11 font-semibold sm:h-[38px]">
              <Icon name="checkCircle" size={16} />
              {t("markAll")}
            </Button>
          </form>
        )}
      </div>

      {data.rows.length === 0 ? (
        <p className="rounded-[15px] border bg-card px-4.5 py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.rows.map((row) => {
            const style = NOTIFICATION_STYLE[row.type];
            const values = notificationValues(row.params);
            return (
              <li key={row.id}>
                <Link
                  href={row.href ?? NOTIFICATION_FALLBACK_HREF}
                  className={cn(
                    "flex items-start gap-3.5 rounded-[13px] border bg-card p-3.5 hover:bg-accent sm:px-4",
                    row.readAt === null && "border-primary/35",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[38px] shrink-0 items-center justify-center rounded-[11px]",
                      style.box,
                    )}
                  >
                    <Icon name={style.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-[13px]",
                          row.readAt === null ? "font-bold" : "font-semibold",
                        )}
                      >
                        {t(`types.${row.type}.title` as never, values as never)}
                      </span>
                      {row.readAt === null && (
                        <span className="rounded-full bg-status-rejected-bg px-2 py-0.5 text-[10px] font-bold text-status-rejected-tx">
                          {t("unreadBadge")}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[12.5px] leading-relaxed text-text-2">
                      {t(`types.${row.type}.body` as never, values as never)}
                    </span>
                    <span className="mt-1.5 block font-mono text-[10.5px] text-muted-foreground">
                      {format.dateTime(row.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                  <Icon
                    name="chevronRight"
                    size={16}
                    className="mt-2 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 overflow-hidden rounded-[15px] border">
        <Pager
          info={t("pageInfo", { from, to, total: data.total })}
          page={page}
          pageCount={data.pageCount}
          hrefFor={(next) => buildHref("/notifications", {}, next)}
          previousLabel={tc("previous")}
          nextLabel={tc("nextPage")}
        />
      </div>
    </div>
  );
}
