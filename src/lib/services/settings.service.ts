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
  slaHours: "review.slaHours",
  userPerHour: "rateLimit.userPerHour",
  ipPerHour: "rateLimit.ipPerHour",
  batchRowsPerDay: "rateLimit.batchRowsPerDay",
  maxFailedLogins: "auth.maxFailedLogins",
  retentionDays: "retention.days",
  auditRetentionYears: "retention.auditYears",
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
    slaHours: envInt("REVIEW_SLA_HOURS", 24),
    userPerHour: envInt("RATE_LIMIT_USER_PER_HOUR", 30),
    ipPerHour: envInt("RATE_LIMIT_IP_PER_HOUR", 60),
    batchRowsPerDay: envInt("BATCH_MAX_ROWS", 500),
    maxFailedLogins: envInt("AUTH_MAX_FAILED_LOGINS", 5),
    retentionDays: envInt("DATA_RETENTION_DAYS", 1825),
    auditRetentionYears: 10,
    linkExpiresDays: envInt("RESULT_LINK_EXPIRES_DAYS", 90),
    announcementTh: "",
    announcementEn: "",
  };
}

async function loadSettings(): Promise<AppSettings> {
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
