import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/db/prisma";
import { EMAIL_PENDING_STALE_MINUTES, STALE_EMAIL_ERROR, staleBefore } from "@/lib/recovery/stale";
import {
  type EmailPayload,
  type EmailTemplateName,
  isEmailTemplateName,
  renderEmail,
} from "./registry";

export type MailMessage = { to: string; subject: string; html: string; text: string };

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
      : undefined,
  });
  return transporter;
}

// F-NOT-04 — ระยะรอก่อนส่งซ้ำของแต่ละครั้งที่ล้มเหลว (นาที) · ครบ 4 ครั้งแล้วหยุด รอผู้ดูแลกดส่งซ้ำเอง
const RETRY_DELAYS_MINUTES = [5, 30, 120, 360];
export const MAX_EMAIL_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1;

function nextRetryAt(attempts: number, now: Date): Date | null {
  const minutes = RETRY_DELAYS_MINUTES[attempts - 1];
  return minutes === undefined ? null : new Date(now.getTime() + minutes * 60_000);
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

// ส่งจริงผ่าน SMTP — ไม่บันทึกอะไร ใช้ภายในไฟล์นี้เท่านั้น
async function transport(message: MailMessage): Promise<void> {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM ?? "Krirk Verify <no-reply@krirk.ac.th>",
    ...message,
  });
}

type SendInput<K extends EmailTemplateName> = {
  template: K;
  to: string;
  payload: EmailPayload<K>;
  userId?: string | null;
  entityType?: string;
  entityId?: string;
};

// F-NOT-01 — ทางเข้าเดียวของการส่งอีเมลทั้งระบบ: render → บันทึก EmailLog → ส่ง → อัปเดตสถานะ
// ส่งไม่สำเร็จต้องไม่ทำให้ธุรกรรมหลัก (ลงทะเบียน/อนุมัติ/ปฏิเสธ) ล้ม — คืน false แล้วให้ retry job ทำต่อ
export async function sendTemplateMail<K extends EmailTemplateName>(
  input: SendInput<K>,
): Promise<boolean> {
  const now = new Date();
  const rendered = renderEmail(input.template, input.payload);
  if (!rendered) {
    console.error("[email] payload ไม่ตรงกับเทมเพลต", input.template);
    return false;
  }

  // แถว log ต้องมีก่อนส่ง เพื่อไม่ให้อีเมลที่ส่งสำเร็จแต่เขียน log ไม่ทันหายไปจากประวัติ
  const log = await prisma.emailLog
    .create({
      data: {
        to: input.to,
        template: input.template,
        subject: rendered.subject,
        locale: (input.payload as { locale?: string }).locale ?? "th",
        payload: input.payload as never,
        userId: input.userId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
      },
      select: { id: true },
    })
    .catch((error: unknown) => {
      console.error("[email] บันทึก EmailLog ไม่สำเร็จ", input.template, error);
      return null;
    });

  try {
    await transport({ to: input.to, ...rendered });
    if (log) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "SENT", attempts: 1, sentAt: new Date(), nextRetryAt: null },
      });
    }
    return true;
  } catch (error) {
    console.error("[email] ส่งอีเมลไม่สำเร็จ", input.template, error);
    if (log) {
      await prisma.emailLog
        .update({
          where: { id: log.id },
          data: {
            status: "FAILED",
            attempts: 1,
            lastError: errorText(error),
            nextRetryAt: nextRetryAt(1, now),
          },
        })
        .catch(() => {});
    }
    return false;
  }
}

type RetryOutcome = { attempted: number; sent: number; failed: number };

// แถวที่ค้าง PENDING = process หยุดระหว่างสร้าง log กับอัปเดตผลการส่ง
// เปลี่ยนเป็น FAILED ที่ถึงกำหนดลองใหม่ทันที ให้ retryEmails รอบเดียวกันส่งต่อ
// (ถ้า SMTP รับไปแล้วก่อน process หยุด ผู้รับอาจได้อีเมลซ้ำหนึ่งฉบับ — ดีกว่าอีเมลหาย)
export async function recoverStalePendingEmails(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.emailLog.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: staleBefore(now, EMAIL_PENDING_STALE_MINUTES) },
    },
    data: { status: "FAILED", attempts: 1, lastError: STALE_EMAIL_ERROR, nextRetryAt: now },
  });
  return count;
}

// ส่งซ้ำแถวที่ถึงกำหนด — เรียกจาก /api/cron/email-retry และจากปุ่มของผู้ดูแลในหน้าประวัติอีเมล
export async function retryEmails(
  where: { id?: string; limit?: number },
  now: Date = new Date(),
): Promise<RetryOutcome> {
  const due = await prisma.emailLog.findMany({
    where: where.id
      ? { id: where.id, status: "FAILED" }
      : { status: "FAILED", attempts: { lt: MAX_EMAIL_ATTEMPTS }, nextRetryAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: where.limit ?? 50,
    select: { id: true, to: true, template: true, payload: true, attempts: true },
  });

  const outcome: RetryOutcome = { attempted: 0, sent: 0, failed: 0 };
  for (const row of due) {
    if (!isEmailTemplateName(row.template)) continue;
    const rendered = renderEmail(row.template, row.payload);
    outcome.attempted++;
    const attempts = row.attempts + 1;

    if (!rendered) {
      // payload เสียรูปแบบ (เช่น เปลี่ยนเทมเพลตหลังบันทึก) — ไม่ต้องลองใหม่อีก
      await prisma.emailLog.update({
        where: { id: row.id },
        data: { attempts, lastError: "payload ไม่ตรงกับเทมเพลต", nextRetryAt: null },
      });
      outcome.failed++;
      continue;
    }

    try {
      await transport({ to: row.to, ...rendered });
      await prisma.emailLog.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          attempts,
          subject: rendered.subject,
          sentAt: new Date(),
          lastError: null,
          nextRetryAt: null,
        },
      });
      outcome.sent++;
    } catch (error) {
      await prisma.emailLog.update({
        where: { id: row.id },
        data: {
          attempts,
          lastError: errorText(error),
          nextRetryAt: attempts >= MAX_EMAIL_ATTEMPTS ? null : nextRetryAt(attempts, now),
        },
      });
      outcome.failed++;
    }
  }
  return outcome;
}
