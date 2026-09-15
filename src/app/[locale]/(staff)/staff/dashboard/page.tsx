import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WelcomePanel } from "@/components/features/dashboard/welcome-panel";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "shell.nav" });
  return { title: t("dashboard") };
}

export default async function StaffDashboardPage({
  params,
}: PageProps<"/[locale]/staff/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const user = await requireRole(STAFF_ROLES);
  return <WelcomePanel user={user} />;
}
