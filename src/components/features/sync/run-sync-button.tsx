"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { runFullSyncAction } from "@/actions/sync";
import { useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function RunSyncButton({ running }: { running: boolean }) {
  const t = useTranslations("sync");
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();
  const busy = pending || running;

  function onClick() {
    startTransition(async () => {
      const result = await runFullSyncAction();
      if (result.ok) {
        toast.success(translate(result.message ?? "sync.started"));
      } else {
        toast.error(translate(result.error ?? "sync.errors.INTERNAL"));
      }
    });
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="h-12 w-full text-[14.5px] font-bold sm:h-[38px] sm:w-auto sm:px-4 sm:text-[13px] sm:font-semibold"
    >
      <Icon name={busy ? "loading" : "refresh"} size={16} className={busy ? "animate-spin" : ""} />
      {busy ? t("running") : t("runFull")}
    </Button>
  );
}
