"use client";

import { useTranslations } from "next-intl";
import { useFormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

// แทน FormMessage ของ shadcn — error จาก Zod เป็น key ของ next-intl จึงต้องแปลก่อนแสดง
export function TranslatedFormMessage({ className, hint }: { className?: string; hint?: string }) {
  const t = useTranslations();
  const { error, formMessageId, formDescriptionId } = useFormField();
  const key = error?.message;

  if (!key) {
    return hint ? (
      <p id={formDescriptionId} className={cn("text-xs text-muted-foreground", className)}>
        {hint}
      </p>
    ) : null;
  }

  return (
    <p id={formMessageId} className={cn("text-xs text-destructive", className)}>
      {t.has(key as never) ? t(key as never) : key}
    </p>
  );
}

export function useTranslateKey() {
  const t = useTranslations();
  return (key: string, values?: Record<string, string | number>) =>
    t.has(key as never) ? t(key as never, values as never) : key;
}
