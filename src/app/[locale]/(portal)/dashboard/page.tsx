import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WelcomePanel } from "@/components/features/dashboard/welcome-panel";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { REQUESTER_ROLES } from "@/lib/auth/rbac";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "shell.nav" });
  return { title: t("dashboard") };
}

export default async function PortalDashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const user = await requireRole(REQUESTER_ROLES);
  return <WelcomePanel user={user} />;
}
