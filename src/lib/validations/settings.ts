import { z } from "zod";

// F-AUD-06 — ค่าตั้งค่าระบบ (ใช้ร่วมระหว่าง service, server action และฟอร์ม)

export const appSettingsSchema = z.object({
  autoApproveEnabled: z.boolean(),
  slaHours: z.number().int().min(1).max(720),
  userPerHour: z.number().int().min(1).max(1000),
  ipPerHour: z.number().int().min(1).max(10_000),
  batchRowsPerDay: z.number().int().min(1).max(100_000),
  maxFailedLogins: z.number().int().min(3).max(20),
  retentionDays: z.number().int().min(365).max(7300),
  auditRetentionYears: z.number().int().min(1).max(30),
  linkExpiresDays: z.number().int().min(1).max(3650),
  announcementTh: z.string().max(300),
  announcementEn: z.string().max(300),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

const DAYS_PER_YEAR = 365;
const int = (min: number, max: number) =>
  z.coerce
    .number("validation.required")
    .int("settings.errors.integer")
    .min(min, "settings.errors.range")
    .max(max, "settings.errors.range");

// ฟอร์มกรอกระยะเก็บคำขอเป็น "ปี" ตามดีไซน์ แล้วแปลงเป็นวันก่อนบันทึก
export const settingsFormSchema = z
  .object({
    autoApproveEnabled: z.boolean(),
    slaHours: int(1, 720),
    userPerHour: int(1, 1000),
    ipPerHour: int(1, 10_000),
    batchRowsPerDay: int(1, 100_000),
    maxFailedLogins: int(3, 20),
    retentionYears: int(1, 20),
    auditRetentionYears: int(1, 30),
    linkExpiresDays: int(1, 3650),
    announcementTh: z.string().trim().max(300, "validation.tooLong"),
    announcementEn: z.string().trim().max(300, "validation.tooLong"),
  })
  .superRefine((data, ctx) => {
    // audit ต้องอยู่นานกว่าคำขอ เพื่อให้ตรวจย้อนหลังการเข้าถึงคำขอได้ตลอดอายุของคำขอ
    if (data.auditRetentionYears < data.retentionYears) {
      ctx.addIssue({
        code: "custom",
        path: ["auditRetentionYears"],
        message: "settings.errors.auditShorter",
      });
    }
  })
  .transform(({ retentionYears, ...rest }): AppSettings => ({
    ...rest,
    retentionDays: retentionYears * DAYS_PER_YEAR,
  }));

export type SettingsFormInput = z.input<typeof settingsFormSchema>;

export function toSettingsForm(settings: AppSettings): SettingsFormInput {
  const { retentionDays, ...rest } = settings;
  return { ...rest, retentionYears: Math.max(1, Math.round(retentionDays / DAYS_PER_YEAR)) };
}
