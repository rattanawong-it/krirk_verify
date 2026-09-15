import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import th from "../../../messages/th.json";
import type { AppLocale } from "@/i18n/routing";
import type { MailMessage } from "./mailer";

// เทมเพลตอีเมลสองภาษา ตาม project-ui/5 Emails & Policy — ใช้ table + inline style เพื่อรองรับ mail client

type Rendered = Omit<MailMessage, "to">;

function translator(locale: AppLocale) {
  return createTranslator({ locale, messages: locale === "en" ? en : th, namespace: "email" });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function maskIp(ip: string | null): string {
  if (!ip) return "-";
  const v4 = ip.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (v4) return `${v4[1]}.${v4[2]}.xx.xx`;
  return ip.split(":").slice(0, 2).join(":") + ":xxxx";
}

function formatDateTime(date: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-buddhist" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

type LayoutInput = {
  locale: AppLocale;
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta: string;
  ctaNote: string;
  url: string;
  warning?: string;
  facts?: { label: string; value: string; mono?: boolean }[];
};

function layout(input: LayoutInput): string {
  const t = translator(input.locale);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const font = "'Anuphan','Inter',Tahoma,Arial,sans-serif";
  const url = escapeHtml(input.url);
  const paragraphs = input.paragraphs
    .map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#4B5A47">${p}</p>`)
    .join("");
  const facts = input.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;border:1px solid #E6EBE2;border-radius:12px;background:#F8FBF7">${input.facts
        .map((f, i) => {
          const line = i > 0 ? "border-top:1px solid #E6EBE2;" : "";
          const mono = f.mono ? "font-family:'JetBrains Mono',Consolas,monospace;" : "";
          return `<tr><td style="padding:10px 14px;width:36%;font-size:12px;color:#5E6D58;${line}">${escapeHtml(f.label)}</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#16210F;${mono}${line}">${escapeHtml(f.value)}</td></tr>`;
        })
        .join("")}</table>`
    : "";
  const warning = input.warning
    ? `<tr><td style="padding:0 28px 8px"><div style="background:#FDF3DA;border:1px solid #F0DCAF;border-radius:12px;padding:14px;font-size:12.5px;line-height:1.6;color:#8A5A06">${input.warning}</div></td></tr>`
    : "";

  return `<!doctype html>
<html lang="${input.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;padding:0;background:#F2F6F1;font-family:${font}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F6F1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#1C6B21;background-image:linear-gradient(135deg,#1C6B21,#0E3A13);padding:24px 28px">
<img src="${appUrl}/brand/kru-logo-white.png" alt="${escapeHtml(th.common.university)}" height="22" style="display:inline-block;vertical-align:middle;height:22px">
<span style="color:rgba(255,255,255,0.55);font-size:13px;padding:0 10px;vertical-align:middle">|</span>
<span style="color:#ffffff;font-size:14px;font-weight:700;vertical-align:middle">Krirk Verify</span>
</td></tr>
<tr><td style="padding:28px 28px 8px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#16210F">${escapeHtml(input.heading)}</h1>
${paragraphs}
${facts}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 10px"><tr><td style="background:#1C6B21;border-radius:11px">
<a href="${url}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${escapeHtml(input.cta)}</a>
</td></tr></table>
<p style="margin:0 0 8px;font-size:11.5px;line-height:1.55;color:#5E6D58">${escapeHtml(input.ctaNote)} ${escapeHtml(t("urlFallback"))}</p>
<div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;color:#4B5A47;background:#F8FBF7;border:1px solid #E6EBE2;border-radius:9px;padding:10px 12px;word-break:break-all;margin-bottom:16px">${url}</div>
</td></tr>
${warning}
<tr><td style="background:#F8FBF7;border-top:1px solid #E6EBE2;padding:20px 28px;font-size:11.5px;line-height:1.65;color:#5E6D58">
${escapeHtml(t("footer"))}<br><span style="color:#7C8B76">reg@krirk.ac.th · 02-970-5820</span>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function verifyEmailTemplate(input: {
  locale: AppLocale;
  url: string;
  kind: "organization" | "alumni";
  orgName?: string;
}): Rendered {
  const t = translator(input.locale);
  const paragraphs =
    input.kind === "organization"
      ? [
          escapeHtml(t("verify.bodyOrg", { orgName: input.orgName ?? "" })),
          escapeHtml(t("verify.bodyOrg2")),
        ]
      : [escapeHtml(t("verify.bodyAlumni"))];

  return {
    subject: t("verify.subject"),
    html: layout({
      locale: input.locale,
      preheader: t("verify.preheader"),
      heading: t("verify.heading"),
      paragraphs,
      cta: t("verify.cta"),
      ctaNote: t("verify.ctaNote"),
      url: input.url,
    }),
    text: `${t("verify.heading")}\n\n${input.kind === "organization" ? t("verify.bodyOrg", { orgName: input.orgName ?? "" }) : t("verify.bodyAlumni")}\n\n${input.url}\n\n${t("verify.ctaNote")}`,
  };
}

export function resetPasswordTemplate(input: {
  locale: AppLocale;
  url: string;
  ipAddress: string | null;
  requestedAt: Date;
}): Rendered {
  const t = translator(input.locale);
  const warning = t("reset.warn", {
    ip: maskIp(input.ipAddress),
    time: formatDateTime(input.requestedAt, input.locale),
  });

  return {
    subject: t("reset.subject"),
    html: layout({
      locale: input.locale,
      preheader: t("reset.preheader"),
      heading: t("reset.heading"),
      paragraphs: [escapeHtml(t("reset.body"))],
      cta: t("reset.cta"),
      ctaNote: t("reset.ctaNote"),
      url: input.url,
      warning: escapeHtml(warning),
    }),
    text: `${t("reset.heading")}\n\n${t("reset.body")}\n\n${input.url}\n\n${t("reset.ctaNote")}\n\n${warning}`,
  };
}

function formatDate(date: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-buddhist" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function factsText(facts: { label: string; value: string }[]): string {
  return facts.map((f) => `${f.label}: ${f.value}`).join("\n");
}

type RejectReasonCode = keyof typeof th.verify.rejectReasons;

// F-REG-05 — แจ้งผู้ขอเมื่อเจ้าหน้าที่ปฏิเสธ (ไม่เปิดเผยชื่อเจ้าหน้าที่ผู้พิจารณา)
export function resultRejectedTemplate(input: {
  locale: AppLocale;
  refNo: string;
  reason: RejectReasonCode;
  detail: string | null;
  decidedAt: Date;
  url: string;
}): Rendered {
  const t = translator(input.locale);
  const messages = input.locale === "en" ? en : th;
  const facts = [
    { label: t("facts.refNo"), value: input.refNo, mono: true },
    { label: t("facts.reason"), value: messages.verify.rejectReasons[input.reason] },
    { label: t("facts.reviewedBy"), value: t("rejected.reviewedBy") },
    { label: t("facts.decided"), value: formatDateTime(input.decidedAt, input.locale) },
  ];
  const paragraphs = [t("rejected.body"), ...(input.detail ? [input.detail] : [])];

  return {
    subject: t("rejected.subject", { refNo: input.refNo }),
    html: layout({
      locale: input.locale,
      preheader: t("rejected.preheader"),
      heading: t("rejected.heading"),
      paragraphs: paragraphs.map(escapeHtml),
      facts,
      cta: t("rejected.cta"),
      ctaNote: t("rejected.ctaNote"),
      url: input.url,
      warning: escapeHtml(t("rejected.warn")),
    }),
    text: `${t("rejected.heading")}\n\n${paragraphs.join("\n\n")}\n\n${factsText(facts)}\n\n${input.url}\n\n${t("rejected.warn")}`,
  };
}

// F-REG-08 — แจ้งผู้ใช้ของหน่วยงานเมื่อได้รับอนุมัติ
export function organizationApprovedTemplate(input: {
  locale: AppLocale;
  orgName: string;
  approvedAt: Date;
  quotaPerHour: number;
  url: string;
}): Rendered {
  const t = translator(input.locale);
  const facts = [
    { label: t("facts.approvedOn"), value: formatDate(input.approvedAt, input.locale) },
    { label: t("facts.singleQuota"), value: t("orgApproved.quota", { count: input.quotaPerHour }) },
  ];
  const body = t("orgApproved.body", { orgName: input.orgName });

  return {
    subject: t("orgApproved.subject"),
    html: layout({
      locale: input.locale,
      preheader: t("orgApproved.preheader"),
      heading: t("orgApproved.heading"),
      paragraphs: [escapeHtml(body)],
      facts,
      cta: t("orgApproved.cta"),
      ctaNote: t("orgApproved.ctaNote"),
      url: input.url,
    }),
    text: `${t("orgApproved.heading")}\n\n${body}\n\n${factsText(facts)}\n\n${input.url}`,
  };
}

type RequestPurpose = keyof typeof th.verify.purposes;

// F-NOT-02: คำขอเข้าคิวเจ้าหน้าที่ (คำขอที่อนุมัติอัตโนมัติจะได้รับอีเมลแจ้งผลแทน)
export function requestReceivedTemplate(input: {
  locale: AppLocale;
  refNo: string;
  searchKey: string;
  purpose: RequestPurpose;
  submittedAt: Date;
  url: string;
}): Rendered {
  const t = translator(input.locale);
  const messages = input.locale === "en" ? en : th;
  const facts = [
    { label: t("facts.refNo"), value: input.refNo, mono: true },
    { label: t("facts.searchKey"), value: input.searchKey, mono: true },
    { label: t("facts.purpose"), value: messages.verify.purposes[input.purpose] },
    { label: t("facts.submitted"), value: formatDateTime(input.submittedAt, input.locale) },
  ];

  return {
    subject: t("received.subject", { refNo: input.refNo }),
    html: layout({
      locale: input.locale,
      preheader: t("received.preheader"),
      heading: t("received.heading"),
      paragraphs: [escapeHtml(t("received.body"))],
      facts,
      cta: t("received.cta"),
      ctaNote: t("received.ctaNote"),
      url: input.url,
    }),
    text: `${t("received.heading")}\n\n${t("received.body")}\n\n${factsText(facts)}\n\n${input.url}`,
  };
}

export function resultApprovedTemplate(input: {
  locale: AppLocale;
  refNo: string;
  fullName: string;
  degree: string;
  graduationDate: Date | null;
  decision: "AUTO" | "MANUAL";
  url: string;
  expiresDays: number;
}): Rendered {
  const t = translator(input.locale);
  const facts = [
    { label: t("facts.refNo"), value: input.refNo, mono: true },
    { label: t("facts.name"), value: input.fullName },
    { label: t("facts.degree"), value: input.degree },
    ...(input.graduationDate
      ? [
          {
            label: t("facts.status"),
            value: t("approved.statusGraduated", {
              date: formatDate(input.graduationDate, input.locale),
            }),
          },
        ]
      : []),
    { label: t("facts.decision"), value: t(`decisions.${input.decision}`) },
  ];

  return {
    subject: t("approved.subject", { refNo: input.refNo }),
    html: layout({
      locale: input.locale,
      preheader: t("approved.preheader"),
      heading: t("approved.heading"),
      paragraphs: [escapeHtml(t("approved.body"))],
      facts,
      cta: t("approved.cta"),
      ctaNote: t("approved.ctaNote", { days: input.expiresDays }),
      url: input.url,
    }),
    text: `${t("approved.heading")}\n\n${t("approved.body")}\n\n${factsText(facts)}\n\n${input.url}\n\n${t("approved.ctaNote", { days: input.expiresDays })}`,
  };
}
