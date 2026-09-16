import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ChangePasswordForm } from "@/components/features/account/change-password-form";
import { ProfileForm } from "@/components/features/account/profile-form";
import { Icon } from "@/components/ui/icon";
import type { AppLocale } from "@/i18n/routing";
import { requireAuth } from "@/lib/auth/guards";
import { getProfile } from "@/lib/services/auth.service";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/profile">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "account" });
  return { title: t("profileTitle") };
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const sessionUser = await requireAuth();
  const [profile, t, format] = await Promise.all([
    getProfile(sessionUser.id),
    getTranslations(),
    getFormatter(),
  ]);
  if (!profile) return null;

  const facts = [
    { label: t("account.email"), value: profile.email, note: t("account.emailLocked") },
    { label: t("account.role"), value: t(`common.roles.${profile.role}`) },
    ...(profile.organization
      ? [
          {
            label: t("account.organization"),
            value: `${locale === "en" ? (profile.organization.nameEn ?? profile.organization.nameTh) : profile.organization.nameTh} · ${t(`account.orgStatus.${profile.organization.status}`)}`,
          },
        ]
      : []),
    ...(profile.student
      ? [
          {
            label: t("auth.registerAlumni.studentCode"),
            value: profile.student.studentCode,
            mono: true,
          },
        ]
      : []),
    ...(profile.lastLoginAt
      ? [
          {
            label: t("account.lastLogin"),
            value: format.dateTime(profile.lastLoginAt, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[22px] font-bold tracking-tight sm:text-[26px]">
        {t("account.profileTitle")}
      </h1>
      <p className="mt-1 mb-5 text-[13.5px] text-muted-foreground">{t("account.profileSub")}</p>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <Icon name="userCircle" size={20} className="text-primary" />
            {t("account.infoSection")}
          </h2>
          <dl className="mb-5 grid gap-px overflow-hidden rounded-xl border bg-border">
            {facts.map((fact) => (
              <div key={fact.label} className="bg-card px-4 py-3">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd
                  className={`mt-0.5 text-sm font-semibold break-words ${"mono" in fact && fact.mono ? "font-mono" : ""}`}
                >
                  {fact.value}
                </dd>
                {"note" in fact && fact.note && (
                  <dd className="mt-0.5 text-[11px] text-muted-foreground">{fact.note}</dd>
                )}
              </div>
            ))}
          </dl>
          <ProfileForm
            defaultValues={{
              name: profile.name,
              position: profile.position ?? "",
              phone: profile.phone ?? "",
              locale: profile.locale === "en" ? "en" : "th",
            }}
          />
        </section>

        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Icon name="lock" size={20} className="text-primary" />
            {t("account.passwordSection")}
          </h2>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">{t("account.passwordSub")}</p>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
