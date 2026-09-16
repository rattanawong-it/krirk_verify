import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { type AppSettings, appSettingsSchema } from "@/lib/validations/settings";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";

// F-AUD-06 — ตั้งค่าระบบเก็บในตาราง AppSetting (key/value)
// ค่าที่ยังไม่เคยบันทึกใช้ค่าจาก env เป็นค่าเริ่มต้น เพื่อให้ระบบที่ติดตั้งแล้วทำงานเหมือนเดิม

export const SETTING_KEYS: Record<keyof AppSettings, string> = {
  autoApproveEnabled: "verification.autoApproveEnabled",
  monthlyReportEnabled: "report.monthlyEmailEnabled",
  queueDigestEnabled: "notify.queueDigestEnabled",
  slaHours: "review.slaHours",
  userPerHour: "rateLimit.userPerHour",
  ipPerHour: "rateLimit.ipPerHour",
  batchRowsPerDay: "rateLimit.batchRowsPerDay",
  maxFailedLogins: "auth.maxFailedLogins",
  retentionDays: "retention.days",
  auditRetentionYears: "retention.auditYears",
  emailLogRetentionDays: "retention.emailLogDays",
  linkExpiresDays: "result.linkExpiresDays",
  announcementTh: "announcement.th",
  announcementEn: "announcement.en",
};

const FIELDS = Object.keys(SETTING_KEYS) as (keyof AppSettings)[];

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function defaultSettings(): AppSettings {
  return {
    autoApproveEnabled: true,
    // F-RPT-08 — ปิดไว้จนกว่าผู้ดูแลจะเปิดเอง
    monthlyReportEnabled: false,
    // F-NOT-03 — เปิดไว้ แต่จะส่งก็ต่อเมื่อ system cron เรียก /api/cron/queue-digest
    queueDigestEnabled: true,
    slaHours: envInt("REVIEW_SLA_HOURS", 24),
    userPerHour: envInt("RATE_LIMIT_USER_PER_HOUR", 30),
    ipPerHour: envInt("RATE_LIMIT_IP_PER_HOUR", 60),
    batchRowsPerDay: envInt("BATCH_MAX_ROWS", 500),
    maxFailedLogins: envInt("AUTH_MAX_FAILED_LOGINS", 5),
    retentionDays: envInt("DATA_RETENTION_DAYS", 1825),
    auditRetentionYears: 10,
    // ประวัติอีเมลใช้ตรวจปัญหาการส่งและส่งซ้ำ — 6 เดือนพอสำหรับข้อร้องเรียน โดยไม่เก็บ payload ที่ระบุตัวบุคคลนานเกินจำเป็น
    emailLogRetentionDays: 180,
    linkExpiresDays: envInt("RESULT_LINK_EXPIRES_DAYS", 90),
    announcementTh: "",
    announcementEn: "",
  };
}

async function loadSettings(): Promise<AppSettings> {
  // F-OPS-01 — ระหว่าง next build (เช่นใน Docker) ไม่มีฐานข้อมูล: หน้า ISR ที่ prerender ใช้ค่าเริ่มต้นไปก่อน
  // แล้วสร้างใหม่ด้วยค่าจริงเมื่อมีผู้เปิดหน้าแรกหลัง deploy (revalidate)
  if (process.env.NEXT_PHASE === "phase-production-build") return defaultSettings();
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const settings = defaultSettings();
  for (const field of FIELDS) {
    const raw = stored.get(SETTING_KEYS[field]);
    if (raw === undefined) continue;
    // ค่าที่เสียรูปแบบในฐานข้อมูลไม่ทำให้ระบบล้ม — ใช้ค่าเริ่มต้นแทน
    const parsed = appSettingsSchema.shape[field].safeParse(raw);
    if (parsed.success) (settings as Record<string, unknown>)[field] = parsed.data;
  }
  return settings;
}

// cache ต่อหนึ่งคำขอ HTTP — หลายส่วนของหน้าเดียวกันอ่านค่าเดียวกันโดยไม่ query ซ้ำ
export const getSettings = cache(loadSettings);

export async function updateSettings(
  next: AppSettings,
  actorId: string,
  context: RequestContext,
): Promise<{ changed: number }> {
  const current = await loadSettings();
  const changes = FIELDS.filter((field) => current[field] !== next[field]).map((field) => ({
    field,
    key: SETTING_KEYS[field],
    from: current[field],
    to: next[field],
  }));
  if (changes.length === 0) return { changed: 0 };

  await prisma.$transaction(
    changes.map(({ key, to }) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value: to },
        update: { value: to },
      }),
    ),
  );

  writeAuditLog({
    action: AuditAction.SETTINGS_CHANGED,
    actorId,
    entityType: "AppSetting",
    metadata: { changes: changes.map(({ key, from, to }) => ({ key, from, to })) },
    context,
  });
  return { changed: changes.length };
}

// ค่าที่งาน retention บันทึกไว้หลังรันแต่ละรอบ (ไม่ใช่ค่าที่ผู้ดูแลแก้ได้)
export const RETENTION_LAST_RUN_KEY = "retention.lastRun";
// เดือนล่าสุดที่ส่งรายงานสรุปแล้ว (YYYY-MM) — กัน cron ส่งซ้ำ
export const MONTHLY_REPORT_LAST_SENT_KEY = "report.monthlyLastSent";
// วันล่าสุด (เวลาไทย YYYY-MM-DD) ที่ส่งสรุปคิวรายวันแล้ว — กัน cron ส่งซ้ำในวันเดียวกัน
export const QUEUE_DIGEST_LAST_SENT_KEY = "notify.queueDigestLastSent";
