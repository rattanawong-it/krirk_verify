import type { Metadata } from "next";
import Image from "next/image";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CopyLinkButton, PrintButton } from "@/components/features/verification/result-actions";
import { ResultCard } from "@/components/features/verification/result-card";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getPublicResult } from "@/lib/services/verification.service";
import { getRequestContext } from "@/lib/utils/request-context";

// F-VER-08 — permalink สาธารณะ /verify/result/[refNo]?t=รหัสเข้าถึง (ตาม project-ui/1 · ผลตรวจสอบ)
// ไม่ต้องล็อกอิน · ไม่ให้ search engine เก็บ · ไม่ส่ง URL ที่มีรหัสเข้าถึงไปใน Referer

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/verify/result/[refNo]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "verify.detail" });
  return {
    title: t("resultTitle"),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function PublicResultPage({
  params,
  searchParams,
}: PageProps<"/[locale]/verify/result/[refNo]">) {
  const { locale, refNo } = await params;
  setRequestLocale(locale as AppLocale);
  const { t: token } = await searchParams;

  const [outcome, t, tc, format] = await Promise.all([
    getPublicResult(
      decodeURIComponent(refNo),
      typeof token === "string" ? token : null,
      await getRequestContext(),
    ),
    getTranslations("verify"),
    getTranslations("common"),
    getFormatter(),
  ]);

  return (
    <div className="min-h-dvh bg-surface px-4 pt-4 pb-10 sm:px-8 sm:pt-7">
      <header className="mx-auto mb-5 flex max-w-[880px] items-center gap-2.5 print:mb-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand/kru-logo.png"
            alt={tc("university")}
            width={128}
            height={22}
            className="h-[22px] w-auto dark:hidden"
          />
          <Image
            src="/brand/kru-logo-white.png"
            alt={tc("university")}
            width={128}
            height={22}
            className="hidden h-[22px] w-auto dark:block"
          />
          <span aria-hidden className="h-5 w-px bg-border" />
          <span className="text-[13px] font-bold">Krirk Verify</span>
        </Link>
        <div className="ml-auto flex items-center gap-2.5 print:hidden">
          {outcome.ok && (
            <span className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-[11.5px] font-semibold text-text-2 sm:inline-flex">
              <Icon name="key" size={14} />
              {t("permalink.viaToken")}
            </span>
          )}
          {/* ปุ่มสลับภาษาเก็บ ?t= ไว้ — ผู้รับลิงก์เปลี่ยนภาษาได้โดยไม่ต้องขอลิงก์ใหม่ (F-UX-08) */}
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-[880px]">
        {outcome.ok ? (
          <>
            <ResultCard
              result={outcome.result}
              issuedBy
              meta={`${outcome.refNo} · ${t("permalink.verifiedAt", {
                date: format.dateTime(outcome.verifiedAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}`}
              actions={
                <>
                  <PrintButton label={t("permalink.print")} />
                  <CopyLinkButton
                    label={t("permalink.copyLink")}
                    copiedLabel={t("permalink.copied")}
                  />
                  <span className="flex items-center gap-2 rounded-[10px] border bg-surface px-3 py-2 text-[11.5px] text-text-2 sm:ml-auto">
                    <Icon name="clock" size={16} />
                    {t("permalink.expires", {
                      date: format.dateTime(outcome.expiresAt, { dateStyle: "medium" }),
                    })}
                  </span>
                </>
              }
            >
              <div className="-mx-4 mt-5 -mb-4 flex items-start gap-3 border-t bg-surface px-4 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
                <Icon name="info" size={18} className="mt-px shrink-0 text-status-info" />
                <p className="text-xs leading-relaxed text-text-2">{t("permalink.footerNote")}</p>
              </div>
            </ResultCard>

            <div className="mt-4 grid gap-3.5 sm:grid-cols-2 print:hidden">
              <section className="rounded-[14px] border bg-card p-4">
                <h2 className="mb-2 text-[12.5px] font-bold">{t("permalink.howToTrust")}</h2>
                <p className="text-[11.5px] leading-relaxed text-text-2">
                  {t("permalink.howToTrustBody")}
                </p>
              </section>
              <section className="rounded-[14px] border bg-card p-4">
                <h2 className="mb-2 text-[12.5px] font-bold">{t("permalink.auditNotice")}</h2>
                <p className="text-[11.5px] leading-relaxed text-text-2">
                  {t("permalink.auditNoticeBody")}
                </p>
              </section>
            </div>
          </>
        ) : (
          <section className="mx-auto flex max-w-[520px] flex-col items-center rounded-[18px] border bg-card p-6 text-center sm:mt-6 sm:p-8">
            <span className="mb-5 flex size-[74px] items-center justify-center rounded-full border-2 border-status-rejected/20 bg-status-rejected-bg text-status-rejected">
              <Icon name={outcome.code === "expired" ? "clock" : "shield"} size={34} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">
              {t(`permalink.${outcome.code}Title`)}
            </h1>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-text-2">
              {t(`permalink.${outcome.code}Body`)}
            </p>
            <Button asChild className="mt-6 h-11 w-full font-bold sm:w-auto">
              <Link href="/">
                <Icon name="search" size={18} />
                {t("permalink.tryAgain")}
              </Link>
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
