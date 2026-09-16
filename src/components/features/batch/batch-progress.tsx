"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

// F-BAT-04 — แถบความคืบหน้า · ระหว่างประมวลผลจะดึงข้อมูลหน้าใหม่เป็นระยะจนกว่างานจะจบ
// (ไม่ใช้ WebSocket ตามหมายเหตุสถาปนิกข้อ 5.1 ที่ไม่เพิ่ม service ให้ทีม IT ดูแล)

const REFRESH_MS = 2500;

export function BatchProgress({
  processing,
  done,
  total,
}: {
  processing: boolean;
  done: number;
  total: number;
}) {
  const t = useTranslations("batch");
  const router = useRouter();

  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [processing, router]);

  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div>
      <div
        role="progressbar"
        aria-label={t("rows")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 overflow-hidden rounded bg-border"
      >
        <div
          className="h-full rounded bg-primary transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
        {processing ? t("processing", { done, total }) : t("done", { total })}
      </p>
    </div>
  );
}
