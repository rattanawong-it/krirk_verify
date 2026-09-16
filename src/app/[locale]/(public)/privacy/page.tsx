import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PolicyDocument } from "@/components/features/policy/policy-document";
import type { AppLocale } from "@/i18n/routing";
import { getSettings } from "@/lib/services/settings.service";

// F-AUD-07 — นโยบายความเป็นส่วนตัว (PDPA) · ระยะเก็บรักษาดึงจากค่าตั้งค่าระบบจริง

// สร้างใหม่ทันทีเมื่อบันทึกค่าตั้งค่า (revalidatePath) และทุก 5 นาทีเป็นค่าสำรอง
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "common" });
  return { title: t("privacyPolicy") };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const [t, tc, settings] = await Promise.all([
    getTranslations("policy.privacy"),
    getTranslations("common"),
    getSettings(),
  ]);

  return (
    <PolicyDocument
      badge={t("badge")}
      title={t("title")}
      version={t("version")}
      updated={t("updated")}
      related={{ href: "/terms", label: tc("terms") }}
      sections={[
        { id: "controller", title: t("s1Title"), paragraphs: [t("s1Body")] },
        {
          id: "data",
          title: t("s2Title"),
          paragraphs: [t("s2Body")],
          items: [
            { icon: "idCard", term: t("s2IdentifiersK"), description: t("s2IdentifiersV") },
            { icon: "graduation", term: t("s2AcademicK"), description: t("s2AcademicV") },
            { icon: "building", term: t("s2RequesterK"), description: t("s2RequesterV") },
          ],
        },
        {
          id: "purpose",
          title: t("s3Title"),
          paragraphs: [t("s3Body")],
          box: { tone: "primary", icon: "checkCircle", text: t("s3Box") },
        },
        { id: "protection", title: t("s4Title"), paragraphs: [t("s4Body")] },
        {
          id: "retention",
          title: t("s5Title"),
          paragraphs: [
            t("s5Body", {
              requestYears: Math.round(settings.retentionDays / 365),
              auditYears: settings.auditRetentionYears,
              linkDays: settings.linkExpiresDays,
              emailDays: settings.emailLogRetentionDays,
            }),
          ],
        },
        {
          id: "rights",
          title: t("s6Title"),
          paragraphs: [t("s6Body")],
          box: { tone: "gold", icon: "info", text: t("s6Box") },
        },
        { id: "contact", title: t("s7Title"), paragraphs: [t("s7Body")] },
      ]}
    />
  );
}
