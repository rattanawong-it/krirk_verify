import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { REQUESTER_ROLES } from "@/lib/auth/rbac";

// F-VER-10 — หน้าแจ้งเตือนเมื่อยื่นคำขอเกินโควตา

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/requests/limit">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "verify.limit" });
  return { title: t("title") };
}

export default async function RequestLimitPage({
  params,
  searchParams,
}: PageProps<"/[locale]/requests/limit">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  await requireRole(REQUESTER_ROLES);

  const { retry } = await searchParams;
  const minutes = Math.min(Math.max(Number(retry) || 60, 1), 60);
  const t = await getTranslations("verify.limit");

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border bg-card p-6 text-center sm:mt-6 sm:p-9">
      <span className="mb-5 flex size-[74px] items-center justify-center rounded-full border-2 border-status-pending/20 bg-status-pending-bg text-status-pending">
        <Icon name="clock" size={34} />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-2">{t("body")}</p>
      <p className="mt-4 rounded-full bg-status-pending-bg px-4 py-1.5 text-[13px] font-bold text-status-pending-tx">
        {t("retry", { minutes })}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">{t("hint")}</p>
      <Button asChild variant="outline" className="mt-6 h-11 w-full font-semibold sm:w-auto">
        <Link href="/requests">
          <Icon name="arrowLeft" size={16} />
          {t("back")}
        </Link>
      </Button>
    </div>
  );
}
