import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

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

// ส่งไม่สำเร็จต้องไม่ทำให้การลงทะเบียน/รีเซ็ตล้ม — คืนค่า false แล้วให้ผู้ใช้กดส่งซ้ำได้
// (EmailLog + retry จะเพิ่มใน Phase 9)
export async function sendMail(message: MailMessage): Promise<boolean> {
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM ?? "Krirk Verify <no-reply@krirk.ac.th>",
      ...message,
    });
    return true;
  } catch (error) {
    console.error("[email] ส่งอีเมลไม่สำเร็จ", message.subject, error);
    return false;
  }
}
