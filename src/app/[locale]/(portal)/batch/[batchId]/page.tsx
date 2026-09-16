import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BatchConfirmButton } from "@/components/features/batch/batch-confirm-button";
import { BatchProgress } from "@/components/features/batch/batch-progress";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { type BatchItemRow, displayStatus, getBatchJob } from "@/lib/services/batch.service";
import { loadViewer } from "@/lib/services/verification.service";
import { cn } from "@/lib/utils";

// F-BAT-04 / F-BAT-05 / F-BAT-06 — ตัวอย่างก่อนยืนยัน → ความคืบหน้า → ผลลัพธ์รายแถว + สรุป + export

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-status-approved-bg text-status-approved-tx",
  PENDING_REVIEW: "bg-status-pending-bg text-status-pending-tx",
  NOT_FOUND: "bg-status-notfound-bg text-status-notfound-tx",
  REJECTED: "bg-status-rejected-bg text-status-rejected-tx",
  INVALID: "bg-status-rejected-bg text-status-rejected-tx",
  ERROR: "bg-status-rejected-bg text-status-rejected-tx",
  PENDING: "bg-muted text-muted-foreground",
};

const SUMMARY_CARDS = [
  { key: "approved", icon: "checkCircle", box: "bg-primary-soft text-primary" },
  { key: "pending", icon: "clock", box: "bg-status-pending-bg text-status-pending" },
  { key: "notFound", icon: "xCircle", box: "bg-status-notfound-bg text-status-notfound" },
  { key: "invalid", icon: "alert", box: "bg-status-rejected-bg text-status-rejected" },
] as const satisfies readonly { key: string; icon: IconName; box: string }[];

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/batch/[batchId]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "batch" });
  return { title: t("title") };
}

export default async function BatchDetailPage({ params }: PageProps<"/[locale]/batch/[batchId]">) {
  const { locale, batchId } = await params;
  setRequestLocale(locale as AppLocale);
  const user = await requireRole(["EXTERNAL"]);

  const viewer = await loadViewer(user.id);
  const job = viewer ? await getBatchJob(batchId, viewer) : null;
  if (!job) notFound();

  const [t, format] = await Promise.all([getTranslations("batch"), getFormatter()]);
  const processing = job.status === "PROCESSING";
  const finished = job.status === "COMPLETED" || job.status === "FAILED";

  const rowLabel = (item: BatchItemRow) => {
    const status = displayStatus(item);
    return {
      status,
      label: t(`statuses.${status}`),
      style: STATUS_STYLE[status] ?? STATUS_STYLE.PENDING!,
      note: item.errorCode ? t(`rowErrors.${item.errorCode}` as never) : "",
    };
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/batch"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <Icon name="arrowLeft" size={14} />
        {t("title")}
      </Link>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold tracking-tight sm:text-[23px]">
            {job.fileName}
          </h1>
          <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">
            {format.dateTime(job.createdAt, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
            {t(`jobStatuses.${job.status}`)} · {job.totalRows} {t("columns.row")}
          </p>
        </div>
        {finished && (
          <Button asChild variant="outline" className="h-11 font-semibold sm:h-[38px]">
            <a href={`/api/batch/${job.id}/export?lang=${locale}`} download>
              <Icon name="files" size={16} />
              {t("exportExcel")}
            </a>
          </Button>
        )}
      </div>

      {job.status === "DRAFT" && (
        <section className="mb-3.5 rounded-[15px] border bg-card p-4.5">
          <BatchConfirmButton batchId={job.id} count={job.validRows} />
        </section>
      )}

      {job.status === "FAILED" && job.errorMessage && (
        <p
          role="alert"
          className="mb-3.5 rounded-[13px] border border-status-rejected/30 bg-status-rejected-bg px-4 py-3 text-[12.5px] text-status-rejected-tx"
        >
          {job.errorMessage}
        </p>
      )}

      {(processing || finished) && (
        <section className="mb-3.5 rounded-[15px] border bg-card p-4.5">
          <BatchProgress processing={processing} done={job.processedRows} total={job.validRows} />
        </section>
      )}

      <div className="grid gap-3.5 lg:grid-cols-[1fr_300px] lg:items-start">
        <section className="overflow-hidden rounded-[15px] border bg-card">
          <h2 className="border-b px-4.5 py-3.5 text-[14px] font-bold">{t("rows")}</h2>
          <ul>
            {job.items.map((item) => {
              const row = rowLabel(item);
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="font-mono text-[11.5px] text-muted-foreground sm:w-10">
                    {item.rowNo}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-[12.5px]">
                    {item.searchValueMasked}
                    {row.note && (
                      <span className="mt-0.5 block font-sans text-[11px] text-status-rejected-tx">
                        {row.note}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[11.5px] sm:w-[168px]">
                    {item.refNo ? (
                      <Link
                        href={`/requests/${item.refNo}`}
                        className="text-primary hover:underline"
                      >
                        {item.refNo}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "self-start rounded-full px-2.5 py-1 text-[11px] font-bold sm:w-[130px] sm:self-auto sm:text-center",
                      row.style,
                    )}
                  >
                    {row.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="rounded-[15px] border bg-card p-4.5">
          <h2 className="mb-3 text-[13.5px] font-bold">{t("summary")}</h2>
          <div className="flex flex-col gap-2.5">
            {SUMMARY_CARDS.map((card) => (
              <div
                key={card.key}
                className={cn("flex items-center gap-3 rounded-[11px] border p-3", card.box)}
              >
                <Icon name={card.icon} size={18} />
                <span className="flex-1 text-[12.5px] font-semibold">
                  {t(`summaryLabels.${card.key}`)}
                </span>
                <span className="text-[16px] font-bold tabular-nums">{job.summary[card.key]}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
