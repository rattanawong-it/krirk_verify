"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// F-BAT-04 — ปุ่มยืนยันเริ่มตรวจสอบ · กดแล้วเซิร์ฟเวอร์ตอบ 202 และประมวลผลต่อเบื้องหลัง

export function BatchConfirmButton({ batchId, count }: { batchId: string; count: number }) {
  const t = useTranslations("batch");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {error && <FormAlert variant="error">{t(error as never)}</FormAlert>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          disabled={pending}
          className="h-12 w-full px-6 text-[15px] font-bold sm:h-[46px] sm:w-auto"
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await fetch(`/api/batch/${batchId}/start`, { method: "POST" });
              if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                setError(`errors.${data.error ?? "notFound"}`);
                return;
              }
              router.refresh();
            })
          }
        >
          <Icon
            name={pending ? "loading" : "shieldCheck"}
            size={18}
            className={pending ? "animate-spin" : ""}
          />
          {t("confirm")}
        </Button>
        <span className="text-center text-[11.5px] text-muted-foreground sm:text-left">
          {t("confirmNote", { count })}
        </span>
      </div>
    </div>
  );
}
