"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// ปุ่มบนหน้าผลตรวจสอบ — ซ่อนตอนพิมพ์ (F-UX-08)

export function PrintButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      className="h-11 w-full font-semibold sm:h-[42px] sm:w-auto print:hidden"
    >
      <Icon name="print" size={18} />
      {label}
    </Button>
  );
}

// url ว่าง = คัดลอก URL ของหน้าปัจจุบัน (หน้า permalink)
export function CopyLinkButton({
  url,
  label,
  copiedLabel,
}: {
  url?: string;
  label: string;
  copiedLabel: string;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url ?? window.location.href);
      toast.success(copiedLabel);
    } catch {
      toast.error(url ?? window.location.href);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={copy}
      className="h-11 w-full font-semibold sm:h-[42px] sm:w-auto print:hidden"
    >
      <Icon name="copy" size={18} />
      {label}
    </Button>
  );
}
