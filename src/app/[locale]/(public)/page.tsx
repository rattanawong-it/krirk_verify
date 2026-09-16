import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResultLookupCard } from "@/components/features/home/result-lookup-card";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getSettings } from "@/lib/services/settings.service";

// หน้าแรกสาธารณะ — project-ui/1 Public & Auth ทางเลือก A (ฮีโร่นำด้วยการค้นหา)

// ประกาศมาจากค่าตั้งค่าระบบ: สร้างใหม่ทันทีเมื่อบันทึก (revalidatePath) และทุก 5 นาทีเป็นค่าสำรอง
export const revalidate = 300;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const [t, settings] = await Promise.all([getTranslations(), getSettings()]);
  // F-AUD-06 — ข้อความประกาศจากหน้าตั้งค่าระบบ (ภาษาอังกฤษไม่มีค่า → ใช้ภาษาไทย)
  const announcement =
    locale === "en" ? settings.announcementEn || settings.announcementTh : settings.announcementTh;

  const stats = [
    { value: t("home.statFree"), label: t("home.statFreeSub") },
    { value: t("home.statPdpa"), label: t("home.statPdpaSub") },
    { value: t("home.statRoles"), label: t("home.statRolesSub") },
  ];

  const steps: { icon: IconName; title: string; sub: string }[] = [
    { icon: "building", title: t("home.step1Title"), sub: t("home.step1Sub") },
    { icon: "fileSearch", title: t("home.step2Title"), sub: t("home.step2Sub") },
    { icon: "shieldCheck", title: t("home.step3Title"), sub: t("home.step3Sub") },
    { icon: "doc", title: t("home.step4Title"), sub: t("home.step4Sub") },
  ];

  return (
    <div className="flex flex-1 flex-col bg-card">
      {announcement && (
        <p
          role="note"
          className="flex items-center justify-center gap-2 bg-gold-soft px-4 py-2 text-center text-[12.5px] font-semibold text-[#6b4e0a] dark:text-gold"
        >
          <Icon name="bell" size={16} className="shrink-0 text-gold" />
          <span className="sr-only">{t("home.announcement")}: </span>
          {announcement}
        </p>
      )}
      <header className="flex h-[58px] items-center gap-4 border-b px-4 sm:h-[70px] sm:gap-7 sm:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/kru-logo.png"
            alt={t("common.university")}
            width={150}
            height={26}
            className="h-5 w-auto sm:h-[26px] dark:hidden"
            priority
          />
          <Image
            src="/brand/kru-logo-white.png"
            alt={t("common.university")}
            width={150}
            height={26}
            className="hidden h-5 w-auto sm:h-[26px] dark:block"
          />
          <span className="hidden h-[26px] w-px bg-border sm:block" aria-hidden />
          <span className="hidden text-sm font-bold sm:inline">Krirk Verify</span>
        </Link>
        <nav className="hidden gap-5 text-[13.5px] lg:flex">
          <a href="#service" className="font-semibold text-primary">
            {t("home.navService")}
          </a>
          <a href="#how" className="text-text-2 hover:text-primary">
            {t("home.navHow")}
          </a>
          <a href="#contact" className="text-text-2 hover:text-primary">
            {t("home.navContact")}
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          <LocaleSwitcher />
          <Button asChild variant="outline" className="h-10 px-4 font-semibold">
            <Link href="/login">{t("common.login")}</Link>
          </Button>
          <Button asChild className="hidden h-10 px-4 font-semibold sm:inline-flex">
            <Link href="/register/organization">{t("common.register")}</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section
          id="service"
          className="relative overflow-hidden bg-[linear-gradient(155deg,#2c8f2b_0%,#1c6b21_46%,#0e3a13_100%)] px-4 pt-8 pb-10 sm:px-10 sm:pt-13 sm:pb-15"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-[340px] rounded-full bg-brand-mark/22"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-52 -bottom-30 size-60 rounded-full bg-white/5"
          />
          <div className="relative mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
            <div className="min-w-0 flex-1 lg:pt-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/14 px-3.5 py-1.5 text-xs font-semibold text-white">
                <Icon name="shieldCheck" size={14} />
                {t("home.heroBadge")}
              </span>
              <h1 className="mt-5 max-w-[560px] text-[26px] leading-tight font-bold tracking-tight text-pretty text-white sm:text-[42px]">
                {t("home.heroTitle")}
              </h1>
              <p className="mt-3.5 max-w-[520px] text-[13.5px] leading-relaxed text-white/80 sm:text-base">
                {t("home.heroSub")}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 bg-white px-6 text-[15px] font-bold text-[#145018] hover:bg-white/90"
                >
                  <Link href="/register/organization">
                    <Icon name="fileSearch" size={18} />
                    {t("home.heroCta")}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/32 bg-white/12 px-5 text-[15px] font-semibold text-white hover:bg-white/20 hover:text-white dark:border-white/32 dark:bg-white/12"
                >
                  <a href="#how">
                    <Icon name="doc" size={18} />
                    {t("home.heroCta2")}
                  </a>
                </Button>
              </div>
              <dl className="mt-8 flex flex-wrap gap-x-7 gap-y-4">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd className="text-xl font-bold text-white sm:text-2xl">{stat.value}</dd>
                    <dd className="mt-0.5 text-xs text-white/70">{stat.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <ResultLookupCard />
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-10 sm:px-10 sm:py-11">
          <div className="mb-7 text-center">
            <p className="text-xs font-bold tracking-[0.14em] text-primary">
              {t("home.howEyebrow")}
            </p>
            <h2 className="mt-2 text-[22px] font-bold sm:text-[26px]">{t("home.howTitle")}</h2>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-[15px] border bg-surface p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon name={step.icon} size={20} />
                  </span>
                  {/* เลขลำดับเป็นของตกแต่ง (ลำดับอยู่ใน <ol> แล้ว) — วาดด้วย ::before เพื่อไม่ให้นับเป็นข้อความที่ต้องผ่าน contrast (WCAG 1.4.3 ยกเว้นส่วนตกแต่ง) */}
                  <span
                    aria-hidden
                    data-step={String(i + 1).padStart(2, "0")}
                    className="font-mono text-[22px] font-medium text-border before:content-[attr(data-step)]"
                  />
                </div>
                <h3 className="text-[15px] font-bold">{step.title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-text-2">{step.sub}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-4 mb-10 flex flex-col gap-4 rounded-2xl border border-gold/35 bg-gold-soft p-5 sm:mx-10 sm:mb-11 sm:flex-row sm:items-start sm:p-6 lg:mx-auto lg:max-w-6xl">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-gold/35 bg-card text-gold">
            <Icon name="lock" size={22} />
          </span>
          <div className="flex-1">
            <h2 className="text-[15px] font-bold text-[#6b4e0a] dark:text-gold">
              {t("home.pdpaTitle")}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#6b4e0a]/90 dark:text-gold/85">
              {t("home.pdpaBody")}
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="h-10 shrink-0 border-gold/35 font-bold text-[#6b4e0a] dark:text-gold"
          >
            <Link href="/privacy">{t("home.pdpaCta")}</Link>
          </Button>
        </section>
      </main>

      <footer id="contact" className="bg-[#16210f] px-4 py-8 text-white sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:gap-14">
          <div className="lg:w-[280px]">
            <Image
              src="/brand/kru-logo-white.png"
              alt={t("common.university")}
              width={130}
              height={22}
              className="mb-3.5 h-[22px] w-auto"
            />
            <p className="text-xs leading-relaxed text-white/60">{t("home.footerAddress")}</p>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-3">
            <FooterColumn
              title={t("home.footerService")}
              items={[t("home.heroCta"), t("home.checkByRef")]}
            />
            <FooterColumn
              title={t("home.footerPolicy")}
              items={[t("common.privacyPolicy"), t("common.terms")]}
            />
            <FooterColumn
              title={t("home.footerContact")}
              items={[
                t("home.footerRegistrar"),
                t("common.contactPhone"),
                "reg@krirk.ac.th",
                t("home.footerHours"),
              ]}
            />
          </div>
          <div className="lg:text-right">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-[11.5px] font-semibold">
              <Icon name="shield" size={14} />
              {t("home.footerBadge")}
            </span>
            <p className="mt-3 font-mono text-[11px] text-white/70">
              v1.0 · {t("home.footerRegistrar")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2.5 text-[12.5px] font-bold">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="text-xs text-white/60">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
