import Image from "next/image";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { VerificationResult } from "@/generated/prisma/client";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { degreeLabel, fullNameEn, fullNameTh } from "@/lib/verification/display";

// F-VER-07 — ผลตรวจสอบครบตาม R-07 + ตราสัญลักษณ์ + เลขอ้างอิง + วันที่ตรวจสอบ
// ใช้ร่วมกันระหว่างหน้ารายละเอียดคำขอ (portal) และ permalink สาธารณะ

const LEVELS = ["BACHELOR", "MASTER", "DOCTORAL"] as const;

type Props = {
  result: VerificationResult;
  meta: string;
  issuedBy?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
};

export async function ResultCard({ result, meta, issuedBy = false, actions, children }: Props) {
  const [t, format, locale] = await Promise.all([
    getTranslations("verify"),
    getFormatter(),
    getLocale(),
  ]);
  const date = (value: Date | null) =>
    value ? format.dateTime(value, { dateStyle: "long", timeZone: "UTC" }) : t("result.none");
  const level = LEVELS.find((l) => l === result.educationLevel);
  const nameEn = fullNameEn(result);

  const fields: { label: string; value: string; mono?: boolean; wide?: boolean }[] = [
    { label: t("result.fullNameTh"), value: fullNameTh(result) },
    ...(nameEn ? [{ label: t("result.fullNameEn"), value: nameEn }] : []),
    { label: t("result.studentCode"), value: result.studentCode, mono: true },
    {
      label: t("result.educationLevel"),
      value: level ? t(`levels.${level}`) : result.educationLevel,
    },
    { label: t("result.degree"), value: degreeLabel(result, locale), wide: true },
    {
      label: t("result.faculty"),
      value: locale === "en" ? (result.facultyEn ?? result.facultyTh) : result.facultyTh,
    },
    { label: t("result.status"), value: t(`studentStatuses.${result.status}`) },
    { label: t("result.graduationDate"), value: date(result.graduationDate) },
    { label: t("result.councilApprovalDate"), value: date(result.councilApprovalDate) },
    {
      label: t("result.gpa"),
      value: result.gpa ? result.gpa.toFixed(2) : t("result.none"),
      mono: true,
    },
    {
      label: t("result.honors"),
      value: result.honors ? t(`honors.${result.honors}`) : t("result.none"),
    },
  ];
  // จำนวนช่องคี่ → ให้ช่องสุดท้ายเต็มแถว ตารางจะไม่มีช่องว่าง
  const slots = fields.reduce((sum, f) => sum + (f.wide ? 2 : 1), 0);
  if (slots % 2 === 1) fields[fields.length - 1]!.wide = true;

  return (
    <article className="overflow-hidden rounded-2xl border bg-card print:rounded-none print:border-0">
      <header className="relative flex flex-col items-center gap-3 overflow-hidden bg-[linear-gradient(135deg,#1c6b21,#0e3a13)] px-5 py-5 text-center sm:flex-row sm:gap-5 sm:px-6 sm:py-5.5 sm:text-left print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-10 size-44 rounded-full bg-gold/18"
        />
        <div className="relative flex size-[58px] shrink-0 items-center justify-center rounded-full border-[2.5px] border-gold bg-gold/15 sm:size-[66px]">
          <Icon name="shieldCheck" size={28} className="text-gold" />
        </div>
        <div className="relative min-w-0 flex-1">
          <p className="text-[10.5px] font-bold tracking-[0.16em] text-white sm:text-[11px]">
            {t("detail.verifiedStamp")}
          </p>
          <h1 className="mt-1 text-base font-bold text-white sm:text-xl">
            {t("detail.resultTitle")}
          </h1>
          <p className="mt-1 font-mono text-[11px] break-all text-white/75 sm:text-xs">{meta}</p>
        </div>
        {issuedBy && (
          <div className="relative hidden text-right sm:block">
            <p className="mb-1 text-[11px] text-white/60">{t("permalink.issuedBy")}</p>
            <Image
              src="/brand/kru-logo-white.png"
              alt=""
              width={116}
              height={20}
              className="ml-auto h-5 w-auto"
            />
          </div>
        )}
      </header>

      <div className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold",
              result.status === "GRADUATED"
                ? "bg-status-approved-bg text-status-approved-tx"
                : "bg-status-rejected-bg text-status-rejected-tx",
            )}
          >
            <Icon name={result.status === "GRADUATED" ? "checkCircle" : "alert"} size={14} />
            {t(`studentStatuses.${result.status}`)}
          </span>
          {result.honors && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft px-3 py-1 text-[11.5px] font-bold text-[#6b4e0a] dark:text-gold">
              <Icon name="star" size={14} className="text-gold" />
              {t(`honors.${result.honors}`)}
            </span>
          )}
        </div>

        <dl className="grid gap-px overflow-hidden rounded-[13px] border bg-border sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.label}
              className={cn("bg-card px-3.5 py-3 sm:px-4", field.wide && "sm:col-span-2")}
            >
              <dt className="mb-0.5 text-[11px] text-muted-foreground">{field.label}</dt>
              <dd
                className={cn(
                  "text-[13.5px] leading-snug font-semibold sm:text-[14.5px]",
                  field.mono && "font-mono",
                )}
              >
                {field.value}
              </dd>
            </div>
          ))}
        </dl>

        {actions && (
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            {actions}
          </div>
        )}
        {children}
      </div>
    </article>
  );
}
