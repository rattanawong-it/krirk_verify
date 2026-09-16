import type { AppLocale } from "@/i18n/routing";
import type { MailMessage } from "./mailer";
import { escapeHtml, layout, translator } from "./templates";

// F-NOT-03 — สรุปคิวคำขอรายวันถึงเจ้าหน้าที่ (รวมเป็นฉบับเดียวต่อวัน ไม่ส่งรายคำขอ)
// ไม่มีข้อมูลส่วนบุคคลของผู้ถูกตรวจสอบในอีเมล — มีเพียงตัวเลขและลิงก์กลับเข้าระบบ

export type QueueDigestSummary = {
  newToday: number;
  pending: number;
  overSla: number;
  oldestWaitHours: number | null;
};

export function queueDigestTemplate(
  input: {
    locale: AppLocale;
    name: string;
    generatedAt: Date;
    url: string;
  } & QueueDigestSummary,
): Omit<MailMessage, "to"> {
  const { locale } = input;
  const t = translator(locale);
  const number = (value: number) =>
    new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-GB").format(value);
  const time = new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-buddhist" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(input.generatedAt);

  const facts = [
    { label: t("queueDigest.newToday"), value: number(input.newToday) },
    { label: t("queueDigest.pending"), value: number(input.pending) },
    { label: t("queueDigest.overSla"), value: number(input.overSla) },
    {
      label: t("queueDigest.oldest"),
      value:
        input.oldestWaitHours === null
          ? "—"
          : t("queueDigest.hours", { hours: input.oldestWaitHours }),
    },
  ];
  const heading = t("queueDigest.heading");
  const body = t("queueDigest.body", { name: input.name, time });

  return {
    subject: t("queueDigest.subject", { count: input.pending }),
    html: layout({
      locale,
      preheader: t("queueDigest.preheader", { count: input.pending, time }),
      heading,
      paragraphs: [escapeHtml(body)],
      facts,
      cta: t("queueDigest.cta"),
      ctaNote: t("queueDigest.ctaNote"),
      url: input.url,
    }),
    text: [
      heading,
      "",
      body,
      "",
      ...facts.map((f) => `${f.label}: ${f.value}`),
      "",
      input.url,
    ].join("\n"),
  };
}
