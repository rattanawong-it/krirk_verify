import type { AppLocale } from "@/i18n/routing";
import type { MailMessage } from "./mailer";
import { escapeHtml, layout, translator } from "./templates";

// F-RPT-08 — อีเมลรายงานสรุปประจำเดือนถึงผู้ดูแลระบบ (ตัวเลขสรุป + ลิงก์ไปหน้ารายงานของเดือนนั้น)

type Summary = {
  total: number;
  byStatus: { APPROVED: number; PENDING_REVIEW: number; NOT_FOUND: number; REJECTED: number };
  autoRate: number | null;
  avgReviewHours: number | null;
};

export function monthlyReportTemplate(input: {
  locale: AppLocale;
  name: string;
  month: Date;
  summary: Summary;
  topOrganizations: { nameTh: string; nameEn: string | null; count: number }[];
  url: string;
}): Omit<MailMessage, "to"> {
  const { locale, summary } = input;
  const t = translator(locale);
  const month = new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-buddhist" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(input.month);
  const number = (value: number) =>
    new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-GB").format(value);

  const facts = [
    { label: t("monthlyReport.total"), value: number(summary.total) },
    { label: t("monthlyReport.approved"), value: number(summary.byStatus.APPROVED) },
    { label: t("monthlyReport.pending"), value: number(summary.byStatus.PENDING_REVIEW) },
    { label: t("monthlyReport.notFound"), value: number(summary.byStatus.NOT_FOUND) },
    { label: t("monthlyReport.rejected"), value: number(summary.byStatus.REJECTED) },
    {
      label: t("monthlyReport.autoRate"),
      value: summary.autoRate === null ? "-" : `${summary.autoRate}%`,
    },
    {
      label: t("monthlyReport.avgReview"),
      value:
        summary.avgReviewHours === null
          ? "-"
          : t("monthlyReport.hours", { hours: summary.avgReviewHours }),
    },
  ];
  const top = input.topOrganizations.length
    ? t("monthlyReport.topOrgs", {
        list: input.topOrganizations
          .map(
            (org, i) =>
              `${i + 1}. ${locale === "en" ? (org.nameEn ?? org.nameTh) : org.nameTh} (${number(org.count)})`,
          )
          .join(" · "),
      })
    : t("monthlyReport.noOrgs");
  const heading = t("monthlyReport.heading", { month });
  const body = t("monthlyReport.body", { name: input.name });

  return {
    subject: t("monthlyReport.subject", { month }),
    html: layout({
      locale,
      preheader: t("monthlyReport.preheader", { month }),
      heading,
      paragraphs: [escapeHtml(body), escapeHtml(top)],
      facts,
      cta: t("monthlyReport.cta"),
      ctaNote: t("monthlyReport.ctaNote"),
      url: input.url,
    }),
    text: [
      heading,
      "",
      body,
      "",
      ...facts.map((f) => `${f.label}: ${f.value}`),
      "",
      top,
      "",
      input.url,
    ].join("\n"),
  };
}
