"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

// ระหว่างมีงานซิงก์กำลังรัน ดึงข้อมูลหน้าใหม่เป็นระยะ เพื่อแสดงความคืบหน้าโดยไม่ต้องกดรีเฟรชเอง
export function SyncAutoRefresh({
  active,
  intervalMs = 3000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
