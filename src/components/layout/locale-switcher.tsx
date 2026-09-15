"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LABELS = { th: "TH", en: "EN" } as const;

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();

  function switchTo(next: (typeof routing.locales)[number]) {
    const query = Object.fromEntries(new URLSearchParams(window.location.search));
    startTransition(() => {
      router.replace({ pathname, query }, { locale: next });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => l !== locale && switchTo(l)}
          className={cn(
            "h-10 min-w-11 rounded-md px-2.5 text-xs font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8",
            l === locale
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
