"use client";

import { useTransition } from "react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// F-NOT-05 — กระดิ่งแจ้งเตือนบน header (ตาม project-ui/3 · แผงแจ้งเตือน)
// ข้อความถูกแปลฝั่งเซิร์ฟเวอร์แล้วส่งมาเป็น props เพื่อให้เวลาและภาษาตรงกันทั้ง SSR และ client

export type BellItem = {
  id: string;
  href: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  icon: IconName;
  box: string;
};

type Props = {
  items: BellItem[];
  unread: number;
  labels: {
    title: string;
    unreadCount: string;
    markAll: string;
    seeAll: string;
    empty: string;
    bell: string;
  };
};

export function NotificationBell({ items, unread, labels }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={labels.bell}
        className="relative flex size-11 items-center justify-center rounded-[9px] border bg-card outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:size-[34px]"
      >
        <Icon name="bell" size={18} className="text-text-2" />
        {unread > 0 && (
          <span className="absolute top-2 right-2 size-[7px] rounded-full border-[1.5px] border-card bg-status-rejected sm:top-1.5 sm:right-1.5" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(352px,calc(100vw-2rem))] p-0">
        <div className="flex items-center gap-2.5 border-b px-3.5 py-3">
          <span className="text-[13.5px] font-bold">{labels.title}</span>
          {unread > 0 && (
            <span className="rounded-full bg-status-rejected-bg px-2 py-0.5 text-[10px] font-bold text-status-rejected-tx">
              {labels.unreadCount}
            </span>
          )}
          {unread > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => void markAllNotificationsReadAction())}
              className="ml-auto text-[11.5px] font-semibold text-primary disabled:opacity-60"
            >
              {labels.markAll}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-3.5 py-10 text-center text-[12.5px] text-muted-foreground">
            {labels.empty}
          </p>
        ) : (
          <ul className="max-h-[352px] overflow-auto">
            {items.map((item) => (
              <li key={item.id}>
                <DropdownMenuItem asChild className="rounded-none border-b p-0 last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={() => startTransition(() => void markNotificationReadAction(item.id))}
                    className={cn(
                      "flex items-start gap-2.75 px-3.5 py-3",
                      item.unread && "bg-surface",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-[30px] shrink-0 items-center justify-center rounded-[9px]",
                        item.box,
                      )}
                    >
                      <Icon name={item.icon} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[12.5px] leading-snug",
                          item.unread ? "font-bold" : "font-semibold",
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-text-2">
                        {item.body}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                        {item.time}
                      </span>
                    </span>
                    {item.unread && (
                      <span className="mt-2.5 block size-2 shrink-0 rounded-full bg-status-rejected" />
                    )}
                  </Link>
                </DropdownMenuItem>
              </li>
            ))}
          </ul>
        )}

        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="rounded-none">
          <Link
            href="/notifications"
            className="flex h-11 items-center justify-center gap-1.5 bg-surface text-[12.5px] font-bold text-primary"
          >
            {labels.seeAll}
            <Icon name="chevronRight" size={14} />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
