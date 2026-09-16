"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// F-BAT-03 — ฟอร์มอัปโหลดไฟล์แบบชุด (ตามดีไซน์ project-ui/2 · หน้าตรวจสอบแบบชุด)
// ค่าคงที่ (จำนวนแถวสูงสุด, รายการวัตถุประสงค์) ส่งมาเป็น props เพราะโมดูลฝั่งเซิร์ฟเวอร์ใช้ node:crypto

type Props = {
  maxRows: number;
  purposes: readonly string[];
  quota: { used: number; limit: number };
};

export function BatchUploadForm({ maxRows, purposes, quota }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [purpose, setPurpose] = useState("");
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const quotaPercent = quota.limit > 0 ? Math.round((quota.used / quota.limit) * 100) : 0;
  const ready = file !== null && purpose !== "" && consent;

  function pick(selected: File | null | undefined) {
    setError(null);
    if (selected) setFile(selected);
  }

  function submit() {
    if (!file || !ready) return;
    setError(null);
    startTransition(async () => {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", purpose);
      body.set("consent", String(consent));

      const res = await fetch("/api/batch/upload", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { batchId?: string; error?: string };
      if (!res.ok || !data.batchId) {
        setError(`batch.errors.${data.error ?? "unreadable"}`);
        return;
      }
      router.push(`/batch/${data.batchId}`);
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      {error && <FormAlert variant="error">{t(error as never)}</FormAlert>}

      <section className="rounded-[15px] border bg-card p-4 sm:p-5.5">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files[0]);
          }}
          className={cn(
            "flex flex-col items-center gap-2.5 rounded-[13px] border-[1.5px] border-dashed bg-surface p-6 text-center transition-colors",
            dragging ? "border-primary bg-primary-soft" : "border-border",
          )}
        >
          <span className="flex size-13 items-center justify-center rounded-[15px] bg-primary-soft">
            <Icon name="upload" size={24} className="text-primary" />
          </span>
          <p className="text-[15px] font-bold">{t("batch.dropTitle")}</p>
          <p className="max-w-[380px] text-[12px] leading-relaxed text-muted-foreground">
            {t("batch.dropSub", { max: maxRows })}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            aria-label={t("batch.chooseFile")}
            // เลือกไฟล์ผ่านปุ่มด้านล่าง — ไม่ให้ Tab หยุดที่ input ที่มองไม่เห็นซ้ำอีกจุด
            tabIndex={-1}
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 font-semibold sm:h-[38px]"
            onClick={() => inputRef.current?.click()}
          >
            {t("batch.chooseFile")}
          </Button>
        </div>

        {file && (
          <p className="mt-3.5 flex items-center gap-3 rounded-xl border bg-surface p-3 text-[13px]">
            <Icon name="files" size={20} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate font-semibold">{file.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {Math.max(1, Math.round(file.size / 1024))} KB
            </span>
          </p>
        )}
      </section>

      <section className="grid gap-4 rounded-[15px] border bg-card p-4 sm:p-5.5">
        <div className="grid gap-2">
          <Label htmlFor="batch-purpose">
            {t("batch.purpose")} <span className="text-destructive">*</span>
          </Label>
          <Select value={purpose || undefined} onValueChange={setPurpose}>
            <SelectTrigger id="batch-purpose" className="h-11 w-full data-[size=default]:h-11">
              <SelectValue placeholder={t("verify.new.purposePh")} />
            </SelectTrigger>
            <SelectContent>
              {purposes.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`verify.purposes.${value}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start gap-3 rounded-[11px] border border-gold/40 bg-gold-soft p-3">
          <Checkbox
            id="batch-consent"
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
            className="mt-0.5 size-5 border-gold data-[state=checked]:border-primary"
          />
          <Label
            htmlFor="batch-consent"
            className="block text-[12.5px] leading-relaxed font-normal"
          >
            {t("verify.new.consent")}{" "}
            <Link href="/privacy" className="font-bold text-primary hover:underline">
              {t("common.privacyPolicy")}
            </Link>{" "}
            <span className="text-destructive">*</span>
          </Label>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          disabled={!ready || pending}
          onClick={submit}
          className="h-12 w-full px-6 text-[15px] font-bold sm:h-[46px] sm:w-auto"
        >
          <Icon
            name={pending ? "loading" : "upload"}
            size={18}
            className={pending ? "animate-spin" : ""}
          />
          {pending ? t("batch.uploading") : t("batch.upload")}
        </Button>
        <span
          className={cn(
            "text-center text-[11.5px] sm:text-left",
            quotaPercent >= 90 ? "font-semibold text-status-pending-tx" : "text-muted-foreground",
          )}
        >
          {t("batch.quotaNote", { used: quota.used, limit: quota.limit })}
        </span>
      </div>
    </div>
  );
}
