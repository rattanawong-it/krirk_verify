import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// F-AUD-07 — โครงหน้านโยบาย/ข้อกำหนด (ตาม project-ui/5 Emails & Policy · นโยบาย PDPA)

export type PolicySection = {
  id: string;
  title: string;
  paragraphs: string[];
  items?: { icon: IconName; term: string; description: string }[];
  box?: { tone: "primary" | "gold"; icon: IconName; text: string };
};

export async function PolicyDocument({
  badge,
  title,
  version,
  updated,
  sections,
  related,
}: {
  badge: string;
  title: string;
  version: string;
  updated: string;
  sections: PolicySection[];
  related: { href: "/privacy" | "/terms"; label: string };
}) {
  const [t, tc] = await Promise.all([getTranslations("policy"), getTranslations("common")]);

  const toc = (
    <ol className="flex flex-col gap-0.5">
      {sections.map((section, index) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="flex min-h-11 items-baseline gap-2.5 rounded-[9px] px-2.5 py-2 text-[12.5px] hover:bg-surface lg:min-h-0"
          >
            <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
              {index + 1}
            </span>
            <span className="leading-snug">{section.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-card">
      <header className="flex h-[58px] items-center gap-3 border-b px-4 sm:h-[70px] sm:gap-5 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/kru-logo.png"
            alt={tc("university")}
            width={150}
            height={26}
            className="h-5 w-auto sm:h-[26px] dark:hidden"
          />
          <Image
            src="/brand/kru-logo-white.png"
            alt={tc("university")}
            width={150}
            height={26}
            className="hidden h-5 w-auto sm:h-[26px] dark:block"
          />
          <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />
          <span className="hidden text-sm font-bold sm:inline">Krirk Verify</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-10 sm:py-9 lg:flex-row lg:gap-10">
        <aside className="lg:sticky lg:top-5 lg:w-[248px] lg:shrink-0 lg:self-start">
          <details className="rounded-xl border lg:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center px-3.5 text-[13px] font-bold">
              {t("contents")}
            </summary>
            <div className="border-t p-1.5">{toc}</div>
          </details>
          <div className="hidden lg:block">
            <p className="mb-3 text-[11.5px] font-bold tracking-[0.04em] text-muted-foreground uppercase">
              {t("contents")}
            </p>
            {toc}
          </div>
          <div className="mt-4 rounded-xl border bg-surface p-3.5">
            <p className="mb-1.5 text-[11.5px] font-bold">{t("dpoTitle")}</p>
            <p className="text-[11px] leading-relaxed text-text-2">{t("dpoBody")}</p>
          </div>
          <Link
            href={related.href}
            className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-[12.5px] font-semibold text-primary hover:bg-surface"
          >
            <Icon name="doc" size={16} />
            <span className="flex-1">{related.label}</span>
            <Icon name="chevronRight" size={14} />
          </Link>
        </aside>

        <main className="max-w-[720px] min-w-0 flex-1">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[11.5px] font-bold text-primary">
            <Icon name="lock" size={14} />
            {badge}
          </span>
          <h1 className="mt-3.5 mb-2.5 text-2xl leading-tight font-bold tracking-tight text-pretty sm:text-[32px]">
            {title}
          </h1>
          <p className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-5 text-xs text-muted-foreground">
            <span>{version}</span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span>{updated}</span>
          </p>

          <div className="flex flex-col gap-7">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-5">
                <h2 className="mb-2.5 flex items-baseline gap-3 text-lg font-bold tracking-tight sm:text-[19px]">
                  <span className="shrink-0 rounded-md bg-primary-soft px-2 py-0.5 font-mono text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  {section.title}
                </h2>
                <div className="flex flex-col gap-3 sm:pl-11">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-[1.75] text-pretty text-text-2">
                      {paragraph}
                    </p>
                  ))}
                  {section.items && (
                    <ul className="flex flex-col gap-2.5">
                      {section.items.map((item) => (
                        <li key={item.term} className="flex items-start gap-2.5">
                          <Icon
                            name={item.icon}
                            size={18}
                            className="mt-0.5 shrink-0 text-primary"
                          />
                          <p className="text-[13.5px] leading-relaxed">
                            <span className="font-bold">{item.term}</span>
                            <span className="text-text-2"> — {item.description}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.box && (
                    <p
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border p-3.5 text-[13px] leading-relaxed",
                        section.box.tone === "primary"
                          ? "border-status-approved/25 bg-status-approved-bg text-status-approved-tx"
                          : "border-gold/40 bg-gold-soft text-[#6b4e0a] dark:text-gold",
                      )}
                    >
                      <Icon
                        name={section.box.icon}
                        size={18}
                        className={cn(
                          "mt-px shrink-0",
                          section.box.tone === "primary" ? "text-status-approved" : "text-gold",
                        )}
                      />
                      {section.box.text}
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
