import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BatchUploadForm } from "@/components/features/batch/batch-upload-form";
import { Pager, buildHref } from "@/components/features/staff/pager";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { BATCH_MAX_ROWS, BATCH_COLUMNS } from "@/lib/batch/rows";
import { BATCH_PAGE_SIZE, listBatchJobs } from "@/lib/services/batch.service";
import { getBatchQuota } from "@/lib/services/rate-limit.service";
import { loadViewer } from "@/lib/services/verification.service";
import { REQUEST_PURPOSES } from "@/lib/validations/verification";
import { batchListQuerySchema } from "@/lib/validations/batch";

// F-BAT-02 / F-BAT-03 — หน้าตรวจสอบแบบชุด (ตามดีไซน์ project-ui/2)

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/batch">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "batch" });
  return { title: t("title") };
}

export default async function BatchPage({ params, searchParams }: PageProps<"/[locale]/batch">) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);
  const user = await requireRole(["EXTERNAL"]);

  const query = batchListQuerySchema.parse(await searchParams);
  const viewer = await loadViewer(user.id);
  const [jobs, quota, t, tc, format] = await Promise.all([
    viewer
      ? listBatchJobs(viewer, query.page)
      : Promise.resolve({ rows: [], total: 0, pageCount: 1 }),
    getBatchQuota(user.id).catch(() => ({ used: 0, limit: 0, remaining: 0 })),
    getTranslations("batch"),
    getTranslations("common"),
    getFormatter(),
  ]);

  const from = jobs.total === 0 ? 0 : (query.page - 1) * BATCH_PAGE_SIZE + 1;
  const to = Math.min(query.page * BATCH_PAGE_SIZE, jobs.total);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight sm:text-[23px]">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="h-11 font-semibold sm:h-[38px]">
            <a href="/api/batch/template?format=csv" download>
              <Icon name="download" size={16} />
              {t("templateCsv")}
            </a>
          </Button>
          <Button asChild variant="outline" className="h-11 font-semibold sm:h-[38px]">
            <a href="/api/batch/template?format=xlsx" download>
              <Icon name="files" size={16} />
              {t("templateXlsx")}
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[1fr_300px] lg:items-start">
        <BatchUploadForm maxRows={BATCH_MAX_ROWS} purposes={REQUEST_PURPOSES} quota={quota} />

        <aside className="flex flex-col gap-3.5">
          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-2.5 text-[13px] font-bold">{t("fileFormat")}</h2>
            <pre className="overflow-x-auto rounded-[10px] border bg-surface p-3 font-mono text-[10.5px] leading-relaxed text-text-2">
              {BATCH_COLUMNS.join(",")}
              {"\n"}CITIZEN_ID,1234567890123{"\n"}PASSPORT,AB123456
            </pre>
          </section>

          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-2.5 text-[13px] font-bold">{t("history")}</h2>
            {jobs.rows.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">{t("empty")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {jobs.rows.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/batch/${job.id}`}
                      className="flex items-center gap-2.5 rounded-[11px] border p-2.5 hover:bg-accent"
                    >
                      <Icon name="files" size={18} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold">
                          {job.fileName}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground">
                          {format.dateTime(job.createdAt, { dateStyle: "short" })} ·{" "}
                          {t(`jobStatuses.${job.status}`)} · {job.processedRows}/{job.validRows}
                        </span>
                      </span>
                      <Icon
                        name="chevronRight"
                        size={16}
                        className="shrink-0 text-muted-foreground"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {jobs.pageCount > 1 && (
              <div className="mt-2 overflow-hidden rounded-[11px] border">
                <Pager
                  info={t("pageInfo", { from, to, total: jobs.total })}
                  page={query.page}
                  pageCount={jobs.pageCount}
                  hrefFor={(page) => buildHref("/batch", {}, page)}
                  previousLabel={tc("previous")}
                  nextLabel={tc("nextPage")}
                />
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
