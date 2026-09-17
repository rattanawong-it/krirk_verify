import { z } from "zod";
import th from "../../../messages/th.json";
import { queueDigestTemplate } from "./digest-templates";
import type { MailMessage } from "./mailer";
import { monthlyReportTemplate } from "./report-templates";
import {
  accountInviteTemplate,
  organizationApprovedTemplate,
  requestReceivedTemplate,
  resetPasswordTemplate,
  resultApprovedTemplate,
  resultRejectedTemplate,
  verifyEmailTemplate,
} from "./templates";

// F-NOT-01 / F-NOT-04 — ทะเบียนเทมเพลตอีเมล
// `EmailLog` เก็บ payload (input ของเทมเพลต) ไม่ใช่ HTML ที่ render แล้ว การ retry จึงต้อง
// แปลง JSON กลับเป็น input ที่ถูกชนิด — schema ในไฟล์นี้ทำหน้าที่นั้น (วันที่ใน JSON เป็น string)

type Rendered = Omit<MailMessage, "to">;

function keysOf<T extends Record<string, unknown>>(
  source: T,
): [keyof T & string, ...(keyof T & string)[]] {
  const keys = Object.keys(source) as (keyof T & string)[];
  return keys as [keyof T & string, ...(keyof T & string)[]];
}

const locale = z.enum(["th", "en"]);
const date = z.coerce.date();
const url = z.string().max(2000);
const text = z.string().max(500);

function define<S extends z.ZodType>(schema: S, render: (payload: z.infer<S>) => Rendered) {
  return { schema, render };
}

export const EMAIL_TEMPLATES = {
  verifyEmail: define(
    z.object({
      locale,
      url,
      kind: z.enum(["organization", "alumni"]),
      orgName: text.optional(),
    }),
    verifyEmailTemplate,
  ),
  resetPassword: define(
    z.object({ locale, url, ipAddress: z.string().max(60).nullable(), requestedAt: date }),
    resetPasswordTemplate,
  ),
  accountInvite: define(
    z.object({
      locale,
      url,
      name: text,
      inviterName: text,
      role: z.enum(keysOf(th.common.roles)),
    }),
    accountInviteTemplate,
  ),
  requestReceived: define(
    z.object({
      locale,
      url,
      refNo: text,
      searchKey: text,
      purpose: z.enum(keysOf(th.verify.purposes)),
      submittedAt: date,
    }),
    requestReceivedTemplate,
  ),
  resultApproved: define(
    z.object({
      locale,
      url,
      refNo: text,
      fullName: text,
      degree: text,
      graduationDate: date.nullable(),
      graduationTerm: z.string().nullish(),
      decision: z.enum(["AUTO", "MANUAL"]),
      expiresDays: z.number().int().min(1).max(3650),
    }),
    resultApprovedTemplate,
  ),
  resultRejected: define(
    z.object({
      locale,
      url,
      refNo: text,
      reason: z.enum(keysOf(th.verify.rejectReasons)),
      detail: text.nullable(),
      decidedAt: date,
    }),
    resultRejectedTemplate,
  ),
  organizationApproved: define(
    z.object({
      locale,
      url,
      orgName: text,
      approvedAt: date,
      quotaPerHour: z.number().int().min(1).max(10_000),
    }),
    organizationApprovedTemplate,
  ),
  monthlyReport: define(
    z.object({
      locale,
      url,
      name: text,
      month: date,
      summary: z.object({
        total: z.number(),
        byStatus: z.object({
          APPROVED: z.number(),
          PENDING_REVIEW: z.number(),
          NOT_FOUND: z.number(),
          REJECTED: z.number(),
        }),
        autoRate: z.number().nullable(),
        avgReviewHours: z.number().nullable(),
      }),
      topOrganizations: z.array(
        z.object({ nameTh: text, nameEn: text.nullable(), count: z.number() }),
      ),
    }),
    monthlyReportTemplate,
  ),
  queueDigest: define(
    z.object({
      locale,
      url,
      name: text,
      generatedAt: date,
      newToday: z.number().int(),
      pending: z.number().int(),
      overSla: z.number().int(),
      oldestWaitHours: z.number().nullable(),
    }),
    queueDigestTemplate,
  ),
} as const;

export type EmailTemplateName = keyof typeof EMAIL_TEMPLATES;
export type EmailPayload<K extends EmailTemplateName> = z.input<
  (typeof EMAIL_TEMPLATES)[K]["schema"]
>;

export const EMAIL_TEMPLATE_NAMES = Object.keys(EMAIL_TEMPLATES).sort() as EmailTemplateName[];

// ต้องใช้ hasOwn — `in` จะจริงกับ constructor/toString ที่สืบทอดมาจาก Object.prototype
// แล้วทำให้ retry หยิบค่าที่ไม่ใช่เทมเพลตไปใช้
export function isEmailTemplateName(value: string): value is EmailTemplateName {
  return Object.hasOwn(EMAIL_TEMPLATES, value);
}

// ใช้ตอนส่งครั้งแรก (payload ถูกชนิดอยู่แล้ว) และตอน retry (payload มาจาก JSON)
export function renderEmail(template: EmailTemplateName, payload: unknown): Rendered | null {
  const entry = EMAIL_TEMPLATES[template];
  const parsed = entry.schema.safeParse(payload);
  if (!parsed.success) return null;
  return entry.render(parsed.data as never);
}
