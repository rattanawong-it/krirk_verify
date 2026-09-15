"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";

// F-UX-09 — error boundary ของทุกหน้าใต้ [locale] · ไม่แสดงรายละเอียดข้อผิดพลาด แสดงเพียงรหัสอ้างอิง (digest)
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations();
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm"
      >
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-status-rejected-bg text-status-rejected">
          <Icon name="alert" size={32} />
        </div>
        <h1 className="text-2xl font-bold">{t("errors.errorTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("errors.errorBody")}
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {t("errors.errorRef", { digest: error.digest })}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Button type="button" onClick={() => retry()} className="h-11 flex-1 font-bold">
            <Icon name="refresh" size={18} />
            {t("errors.retry")}
          </Button>
          <Button asChild variant="outline" className="h-11 flex-1">
            <Link href="/">{t("common.backToHome")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
