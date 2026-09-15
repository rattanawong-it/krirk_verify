import "server-only";
import { getTranslations } from "next-intl/server";
import type { OrgActionLabels } from "./org-action-buttons";

// ข้อความของปุ่ม/กล่องยืนยันหน่วยงาน — ใช้ร่วมระหว่างหน้ารายการและหน้าประวัติการใช้งาน
export async function orgActionLabels(orgName: string): Promise<OrgActionLabels> {
  const t = await getTranslations("orgs");
  return {
    actions: {
      approve: t("actions.approve"),
      reject: t("actions.reject"),
      suspend: t("actions.suspend"),
      restore: t("actions.restore"),
    },
    titles: {
      approve: t("confirm.approveTitle", { name: orgName }),
      reject: t("confirm.rejectTitle", { name: orgName }),
      suspend: t("confirm.suspendTitle", { name: orgName }),
      restore: t("confirm.restoreTitle", { name: orgName }),
    },
    bodies: {
      approve: t("confirm.approveBody"),
      reject: t("confirm.rejectBody"),
      suspend: t("confirm.suspendBody"),
      restore: t("confirm.restoreBody"),
    },
    reason: t("confirm.reason"),
    reasonPh: t("confirm.reasonPh"),
    submit: t("confirm.submit"),
    submitting: t("confirm.submitting"),
    cancel: t("confirm.cancel"),
  };
}
