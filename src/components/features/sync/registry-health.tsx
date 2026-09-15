import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/ui/icon";
import { checkRegistryHealth } from "@/lib/services/sync.service";

// อยู่ใน <Suspense> — ถ้าระบบทะเบียนตอบช้า ส่วนอื่นของหน้าไม่ต้องรอ
export async function RegistryHealth() {
  const [health, t] = await Promise.all([checkRegistryHealth(), getTranslations("sync")]);

  if (health.ok) {
    return (
      <span className="flex items-center gap-1.5 font-semibold">
        <Icon name="checkCircle" size={14} className="text-status-approved" />
        {t("api.reachable")}
        <span className="font-mono text-[11px] font-normal text-muted-foreground">
          {health.latencyMs} ms
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-0.5 text-right">
      <span className="flex items-center gap-1.5 font-semibold text-status-rejected-tx">
        <Icon name="xCircle" size={14} className="text-status-rejected" />
        {t("api.unreachable")}
      </span>
      <span className="text-[11px] font-normal text-muted-foreground">
        {t(`errors.${health.code}`)}
      </span>
    </span>
  );
}
