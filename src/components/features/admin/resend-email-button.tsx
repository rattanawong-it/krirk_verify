"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { resendEmailAction } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// F-NOT-04 — ปุ่มส่งซ้ำอีเมลที่ล้มเหลว (ADMIN) · ใช้ในหน้าประวัติการส่งอีเมล

export function ResendEmailButton({ id }: { id: string }) {
  const t = useTranslations("emailLogs");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      className="h-11 shrink-0 font-semibold sm:h-8"
      onClick={() =>
        startTransition(async () => {
          const result = await resendEmailAction({ id });
          if (result.ok) {
            toast.success(t("done.resent"));
            return;
          }
          const notFound = result.error === "emailLogs.errors.notFound";
          toast.error(t(notFound ? "errors.notFound" : "errors.stillFailing"));
        })
      }
    >
      <Icon name="sync" size={14} />
      {pending ? t("resending") : t("resend")}
    </Button>
  );
}
