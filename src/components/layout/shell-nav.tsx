"use client";

import { Icon, type IconName } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "./nav-config";

export type ShellNavItem = { href: string; label: string; icon: IconName; available: boolean };

export function SidebarNav({ items, comingSoon }: { items: ShellNavItem[]; comingSoon: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="main">
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const content = (
            <>
              <Icon name={item.icon} size={18} />
              <span className="flex-1 truncate">{item.label}</span>
            </>
          );
          const base =
            "flex min-h-10 w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-brand-mark";

          return (
            <li key={item.href}>
              {item.available ? (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    base,
                    active
                      ? "bg-white/12 font-bold text-white"
                      : "text-white/70 hover:bg-white/8 hover:text-white",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      aria-disabled="true"
                      tabIndex={0}
                      className={cn(base, "cursor-not-allowed text-white/35")}
                    >
                      {content}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">{comingSoon}</TooltipContent>
                </Tooltip>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileBottomNav({ items }: { items: ShellNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const className = cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10.5px] font-semibold",
            active ? "text-primary" : "text-muted-foreground",
            !item.available && "opacity-40",
          );
          return (
            <li key={item.href}>
              {item.available ? (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  <Icon name={item.icon} size={20} />
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : (
                <span aria-disabled="true" className={className}>
                  <Icon name={item.icon} size={20} />
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
