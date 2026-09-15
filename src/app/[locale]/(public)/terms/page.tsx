import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PolicyDocument } from "@/components/features/policy/policy-document";
import type { AppLocale } from "@/i18n/routing";

// F-AUD-07 — ข้อกำหนดการใช้บริการ (ใช้โครงเดียวกับหน้านโยบายความเป็นส่วนตัว)

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "common" });
  return { title: t("terms") };
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const [t, tc] = await Promise.all([getTranslations("policy.terms"), getTranslations("common")]);

  return (
    <PolicyDocument
      badge={t("badge")}
      title={t("title")}
      version={t("version")}
      updated={t("updated")}
      related={{ href: "/privacy", label: tc("privacyPolicy") }}
      sections={[
        { id: "scope", title: t("t1Title"), paragraphs: [t("t1Body")] },
        { id: "accounts", title: t("t2Title"), paragraphs: [t("t2Body")] },
        {
          id: "use",
          title: t("t3Title"),
          paragraphs: [t("t3Body")],
          box: { tone: "primary", icon: "shieldCheck", text: t("t3Box") },
        },
        { id: "results", title: t("t4Title"), paragraphs: [t("t4Body")] },
        { id: "liability", title: t("t5Title"), paragraphs: [t("t5Body")] },
        { id: "changes", title: t("t6Title"), paragraphs: [t("t6Body")] },
      ]}
    />
  );
}
