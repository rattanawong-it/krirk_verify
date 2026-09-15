import "server-only";
import { prisma } from "@/lib/db/prisma";

// อ่านค่าตั้งค่าระบบจากตาราง AppSetting — หน้าแก้ไขค่าอยู่ใน F-AUD-06 (Phase 7)

export const SettingKey = {
  AUTO_APPROVE_ENABLED: "verification.autoApproveEnabled",
} as const;

export async function getBooleanSetting(key: string, fallback: boolean): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } });
  return typeof row?.value === "boolean" ? row.value : fallback;
}
