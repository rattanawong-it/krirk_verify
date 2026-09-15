import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

// F-UX-09 — โครงหน้าระหว่างโหลดของพื้นที่ที่มี App shell (หัวข้อ + การ์ดสรุป + รายการ)
export function PageSkeleton() {
  const t = useTranslations("common");
  return (
    <div className="mx-auto max-w-6xl" role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-7 w-56 max-w-full" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-[14px]" />
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-[15px] border bg-card">
        <Skeleton className="h-14 rounded-none" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t px-4 py-3.5">
            <Skeleton className="size-9 shrink-0 rounded-[10px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
