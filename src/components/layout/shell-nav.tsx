"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "./nav-config";

export type ShellNavItem = { href: string; label: string; icon: IconName; available: boolean };

export function SidebarNav({
  items,
  comingSoon,
  label,
}: {
  items: ShellNavItem[];
  comingSoon: string;
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
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

// จำนวนช่องสูงสุดของ bottom nav — เกินกว่านี้แสดง 3 เมนูแรก + ปุ่ม "เมนู" ที่เปิด drawer (F-UX-05)
const MAX_BOTTOM_ITEMS = 4;

export function MobileBottomNav({
  items,
  labels,
}: {
  items: ShellNavItem[];
  labels: { nav: string; menu: string; openMenu: string; closeMenu: string; comingSoon: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const overflow = items.length > MAX_BOTTOM_ITEMS;
  const primary = overflow ? items.slice(0, MAX_BOTTOM_ITEMS - 1) : items;
  const menuActive =
    overflow && items.slice(MAX_BOTTOM_ITEMS - 1).some((item) => isNavItemActive(item, pathname));
  const columns = primary.length + (overflow ? 1 : 0);

  const cell = (active: boolean, disabled = false) =>
    cn(
      "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[10.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      active ? "text-primary" : "text-muted-foreground",
      disabled && "opacity-40",
    );

  return (
    <nav
      aria-label={labels.nav}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {primary.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <li key={item.href}>
              {item.available ? (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cell(active)}
                >
                  <Icon name={item.icon} size={20} />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              ) : (
                <span aria-disabled="true" className={cell(false, true)}>
                  <Icon name={item.icon} size={20} />
                  <span className="max-w-full truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
        {overflow && (
          <li>
            <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
              <DialogPrimitive.Trigger className={cell(menuActive)} aria-label={labels.openMenu}>
                <Icon name="menu" size={20} />
                <span>{labels.menu}</span>
              </DialogPrimitive.Trigger>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden" />
                <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t bg-card px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom lg:hidden">
                  <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
                  <div className="mb-3 flex items-center justify-between">
                    <DialogPrimitive.Title className="text-[15px] font-bold">
                      {labels.menu}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Close
                      className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={labels.closeMenu}
                    >
                      <Icon name="close" size={20} />
                    </DialogPrimitive.Close>
                  </div>
                  <DialogPrimitive.Description className="sr-only">
                    {labels.nav}
                  </DialogPrimitive.Description>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {items.map((item) => {
                      const active = isNavItemActive(item, pathname);
                      const tile = cn(
                        "flex min-h-[72px] flex-col items-start justify-between gap-2 rounded-xl border p-3 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "border-primary bg-primary-soft text-primary" : "bg-surface",
                      );
                      return (
                        <li key={item.href}>
                          {item.available ? (
                            <Link
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              onClick={() => setOpen(false)}
                              className={tile}
                            >
                              <Icon name={item.icon} size={20} />
                              <span>{item.label}</span>
                            </Link>
                          ) : (
                            <span aria-disabled="true" className={cn(tile, "opacity-50")}>
                              <Icon name={item.icon} size={20} />
                              <span>
                                {item.label}
                                <span className="block text-[10.5px] font-normal text-muted-foreground">
                                  {labels.comingSoon}
                                </span>
                              </span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          </li>
        )}
      </ul>
    </nav>
  );
}
