import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/guards";
import { homePathFor } from "@/lib/auth/rbac";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/forbidden">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "auth.forbidden" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ForbiddenPage({ params }: PageProps<"/[locale]/forbidden">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations();
  const user = await getCurrentUser();

  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-4 py-16">
      <div className="w-full max-w-md rounded-[18px] border bg-card p-8 text-center">
        <div className="mx-auto mb-5 flex size-[74px] items-center justify-center rounded-full border-2 border-status-rejected/20 bg-status-rejected-bg text-status-rejected">
          <Icon name="lock" size={34} />
        </div>
        <p className="font-mono text-sm text-muted-foreground">403</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{t("auth.forbidden.title")}</h1>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-2">
          {t("auth.forbidden.body")}
        </p>
        <Button asChild className="mt-6 h-11 w-full text-[15px] font-bold">
          <Link href={user ? homePathFor(user.role) : "/"}>
            {user ? t("auth.forbidden.goDashboard") : t("common.backToHome")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
