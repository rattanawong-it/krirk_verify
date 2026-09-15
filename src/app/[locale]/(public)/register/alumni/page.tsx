import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RegisterAlumniForm } from "@/components/features/auth/register-alumni-form";
import { RegisterShell } from "@/components/layout/register-shell";
import { Icon, type IconName } from "@/components/ui/icon";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/register/alumni">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as AppLocale,
    namespace: "auth.registerAlumni",
  });
  return { title: t("title") };
}

export default async function RegisterAlumniPage({
  params,
}: PageProps<"/[locale]/register/alumni">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();

  const perks: { icon: IconName; title: string; sub: string }[] = [
    {
      icon: "graduation",
      title: t("auth.registerAlumni.perk1Title"),
      sub: t("auth.registerAlumni.perk1Sub"),
    },
    {
      icon: "link",
      title: t("auth.registerAlumni.perk2Title"),
      sub: t("auth.registerAlumni.perk2Sub"),
    },
    {
      icon: "history",
      title: t("auth.registerAlumni.perk3Title"),
      sub: t("auth.registerAlumni.perk3Sub"),
    },
  ];

  return (
    <RegisterShell
      logoAlt={t("common.university")}
      haveAccount={t("auth.registerOrg.haveAccount")}
      loginLabel={t("common.login")}
    >
      <div className="mx-auto max-w-[760px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11.5px] font-bold text-secondary-foreground">
          <Icon name="graduation" size={14} />
          {t("auth.registerAlumni.badge")}
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-[28px]">
          {t("auth.registerAlumni.title")}
        </h1>
        <p className="mt-2 mb-6 text-[13.5px] leading-relaxed text-muted-foreground">
          {t("auth.registerAlumni.subtitle")}
        </p>

        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <section className="min-w-0 flex-1 rounded-2xl border bg-card p-5 sm:p-6">
            <RegisterAlumniForm />
          </section>
          <aside className="rounded-2xl border bg-card p-4.5 md:w-[250px] md:shrink-0">
            <h2 className="mb-3 text-[13.5px] font-bold">{t("auth.registerAlumni.canDo")}</h2>
            <ul className="space-y-3">
              {perks.map((perk) => (
                <li key={perk.title} className="flex items-start gap-2.5">
                  <Icon name={perk.icon} size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-[12.5px] font-bold">{perk.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {perk.sub}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </RegisterShell>
  );
}
