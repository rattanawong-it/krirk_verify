"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { RevealState } from "@/actions/review";
import { refreshStudentAction } from "@/actions/sync";
import { useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

// ปุ่มเล็กที่ใช้ร่วมกันในหน้าเจ้าหน้าที่

// ดูเลขบัตร/พาสปอร์ตเต็ม — action ถูก bind ค่าไว้จากฝั่ง server และบันทึก audit ทุกครั้ง
export function RevealButton({
  action,
  label,
  pendingLabel,
  failedLabel,
}: {
  action: () => Promise<RevealState>;
  label: string;
  pendingLabel: string;
  failedLabel: string;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (value) {
    return <span className="font-mono text-[13px] font-semibold tracking-wide">{value}</span>;
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          if (result.ok) setValue(result.value);
          else toast.error(failedLabel);
        })
      }
      className="h-11 shrink-0 border-gold/50 font-bold text-[#6b4e0a] sm:h-8 dark:text-gold"
    >
      <Icon
        name={pending ? "loading" : "eye"}
        size={14}
        className={pending ? "animate-spin" : ""}
      />
      {pending ? pendingLabel : label}
    </Button>
  );
}

// F-DATA-09 — ดึงข้อมูลรายคนจากระบบทะเบียน
export function RefreshStudentButton({
  studentCode,
  label,
  pendingLabel,
  className,
}: {
  studentCode: string;
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await refreshStudentAction(studentCode);
          if (result.ok) toast.success(translate(result.message ?? "sync.refreshed"));
          else toast.error(translate(result.error ?? "sync.errors.INTERNAL"));
        })
      }
      className={cn("h-11 font-semibold sm:h-8", className)}
    >
      <Icon
        name={pending ? "loading" : "refresh"}
        size={14}
        className={pending ? "animate-spin" : ""}
      />
      {pending ? pendingLabel : label}
    </Button>
  );
}
