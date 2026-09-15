"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

// เปิดผลตรวจสอบเดิมด้วยเลขอ้างอิง + รหัสเข้าถึง → permalink /verify/result/[refNo] (F-VER-08, Phase 3)
export function ResultLookupCard() {
  const t = useTranslations("home");
  const router = useRouter();
  const [refNo, setRefNo] = useState("");
  const [token, setToken] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const ref = refNo.trim().toUpperCase();
    router.push(`/verify/result/${encodeURIComponent(ref)}?t=${encodeURIComponent(token.trim())}`);
  }

  return (
    <div className="w-full rounded-[18px] bg-card p-5 text-card-foreground shadow-[0_20px_50px_rgba(14,58,19,0.28)] sm:p-6 lg:w-[392px] lg:shrink-0">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Icon name="search" size={20} className="text-primary" />
        {t("checkByRef")}
      </h2>
      <p className="mt-1 mb-4 text-[12.5px] leading-relaxed text-muted-foreground">
        {t("checkByRefSub")}
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="lookup-ref">{t("refNo")}</Label>
          <div className="relative">
            <Icon
              name="doc"
              size={18}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="lookup-ref"
              required
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              pattern="[Kk][Rr][Uu]-[0-9]{4}-[0-9]{6}"
              placeholder="KRU-2569-000123"
              autoComplete="off"
              className="h-11 pl-10 font-mono"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lookup-token">{t("accessToken")}</Label>
          <div className="relative">
            <Icon
              name="key"
              size={18}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="lookup-token"
              required
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              className="h-11 pl-10 font-mono"
            />
          </div>
        </div>
        <Button type="submit" className="h-11 w-full text-[15px] font-bold">
          <Icon name="shieldCheck" size={18} />
          {t("checkBtn")}
        </Button>
      </form>

      <FormAlert variant="info" className="mt-3.5">
        {t("checkNote")}
      </FormAlert>
    </div>
  );
}
