"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";

// F-AUD-03 — รายละเอียดของบันทึกแต่ละรายการ (IP เต็ม, เบราว์เซอร์, metadata ทั้งหมด)

export type AuditDetail = {
  title: string;
  action: string;
  time: string;
  actor: string;
  entity: string;
  ip: string;
  userAgent: string;
  metadata: string;
};

export function AuditDetailButton({ detail }: { detail: AuditDetail }) {
  const t = useTranslations("audit");
  const rows = [
    { label: t("fields.time"), value: detail.time },
    { label: t("fields.action"), value: detail.action, mono: true },
    { label: t("fields.actor"), value: detail.actor },
    { label: t("fields.entity"), value: detail.entity, mono: true },
    { label: t("fields.ip"), value: detail.ip, mono: true },
    { label: t("fields.userAgent"), value: detail.userAgent },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 shrink-0 font-semibold sm:h-8"
        >
          <Icon name="eye" size={14} />
          {t("detail")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("detailTitle")}</DialogTitle>
          <DialogDescription>{detail.title}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-px overflow-hidden rounded-xl border bg-border text-[12.5px]">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1 bg-card px-3 py-2 sm:grid-cols-[130px_1fr]">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className={`break-all ${row.mono ? "font-mono text-[12px]" : ""}`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="mb-1.5 text-[12px] font-semibold">{t("fields.metadata")}</p>
          <pre className="max-h-64 overflow-auto rounded-xl border bg-surface p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
            {detail.metadata}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
