"use client";

import { useTheme } from "next-themes";
import { useTransition } from "react";
import { logoutAction } from "@/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";

type Props = {
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  labels: { profile: string; logout: string; theme: string };
};

function initialOf(name: string): string {
  const withoutPrefix = name.replace(/^(นางสาว|นาง|นาย|ดร\.|Mr\.|Mrs\.|Ms\.|Dr\.)\s*/, "");
  return Array.from(withoutPrefix.trim())[0]?.toUpperCase() ?? "?";
}

export function UserMenu({ name, email, role, roleLabel, labels }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-10 items-center gap-2.5 rounded-lg px-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-secondary-foreground">
          {initialOf(name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-40 truncate text-xs font-semibold">{name}</span>
          <span className="block font-mono text-[9.5px] text-muted-foreground">{role}</span>
        </span>
        <Icon name="chevronDown" size={16} className="hidden text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs text-primary">{roleLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-10">
          <Link href="/profile">
            <Icon name="userCircle" size={18} />
            {labels.profile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-10" onSelect={() => setTheme(isDark ? "light" : "dark")}>
          <Icon name={isDark ? "sun" : "moon"} size={18} />
          {labels.theme}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-10"
          disabled={pending}
          onSelect={() => startTransition(() => logoutAction())}
        >
          <Icon name="logout" size={18} />
          {labels.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
