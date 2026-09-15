import { getFormatter, getTranslations } from "next-intl/server";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { type SyncHistoryJob, normalizeSyncErrorCode } from "@/lib/services/sync.service";
import { formatDuration } from "@/lib/utils/duration";
import { cn } from "@/lib/utils";

const STATUS_STYLE = {
  SUCCESS: { pill: "bg-status-approved-bg text-status-approved-tx", dot: "bg-status-approved" },
  FAILED: { pill: "bg-status-rejected-bg text-status-rejected-tx", dot: "bg-status-rejected" },
  RUNNING: { pill: "bg-status-info-bg text-status-info-tx", dot: "bg-status-info animate-pulse" },
} as const;

type Props = { jobs: SyncHistoryJob[]; page: number; pageCount: number };

export async function SyncHistory({ jobs, page, pageCount }: Props) {
  const [t, format] = await Promise.all([getTranslations("sync"), getFormatter()]);

  const rows = jobs.map((job) => {
    const numbers = {
      fetched: format.number(job.recordsFetched),
      upserted: format.number(job.recordsUpserted),
    };
    const parts: string[] = [];
    if (job.type === "SINGLE")
      parts.push(t("result.single", { studentCode: job.studentCode ?? "—" }));
    if (job.status === "FAILED") {
      parts.push(t(`errors.${normalizeSyncErrorCode(job.errorCode)}`));
    } else if (job.status === "RUNNING") {
      parts.push(t("result.running", numbers));
    } else if (job.type !== "SINGLE") {
      parts.push(t("result.bulk", numbers));
      if (job.recordsInvalid > 0) {
        parts.push(t("result.invalid", { count: format.number(job.recordsInvalid) }));
      }
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      started: format.dateTime(job.startedAt, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      result: parts.join(" · "),
      actor: job.triggeredBy
        ? t("result.byUser", { name: job.triggeredBy.name })
        : t("result.byCron"),
      duration: job.finishedAt
        ? formatDuration(job.finishedAt.getTime() - job.startedAt.getTime())
        : "—",
    };
  });

  const statusPill = (status: keyof typeof STATUS_STYLE, compact = false) => (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap",
        compact ? "px-2.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[10.5px]",
        STATUS_STYLE[status].pill,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_STYLE[status].dot)} />
      {t(`statuses.${status}`)}
    </span>
  );

  return (
    <section className="overflow-hidden rounded-[15px] border bg-card">
      <h2 className="border-b px-4.5 py-3.5 text-sm font-bold">{t("history")}</h2>

      {rows.length === 0 ? (
        <p className="px-4.5 py-10 text-center text-sm text-muted-foreground">
          {t("historyEmpty")}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-surface text-[11.5px] font-bold text-muted-foreground">
                <tr>
                  <th scope="col" className="w-[140px] px-4.5 py-2.5 font-bold">
                    {t("columns.started")}
                  </th>
                  <th scope="col" className="w-[118px] px-3 py-2.5 font-bold">
                    {t("columns.type")}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-bold">
                    {t("columns.result")}
                  </th>
                  <th scope="col" className="w-[96px] px-3 py-2.5 font-bold">
                    {t("columns.duration")}
                  </th>
                  <th scope="col" className="w-[108px] px-4.5 py-2.5 font-bold">
                    {t("columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4.5 py-3 font-mono text-[11.5px] text-muted-foreground">
                      {row.started}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        title={t(`types.${row.type}`)}
                        className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10.5px] font-medium text-muted-foreground"
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-foreground/85">{row.result}</span>
                      <span className="block text-[11px] text-muted-foreground">{row.actor}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11.5px] text-muted-foreground">
                      {row.duration}
                    </td>
                    <td className="px-4.5 py-3">{statusPill(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-px bg-border md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="bg-card px-3.5 py-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {row.started} · {row.type}
                  </span>
                  {statusPill(row.status, true)}
                </div>
                <p className="text-xs text-foreground/85">{row.result}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {row.actor} · {row.duration}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-between gap-3 border-t px-4.5 py-3 text-xs">
          <span className="text-muted-foreground">
            {t("pagination.summary", { page, pageCount })}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{ pathname: "/staff/sync", query: { page: page - 1 } }}
                className="inline-flex h-11 items-center gap-1 rounded-lg border px-3 font-semibold hover:bg-muted md:h-8"
              >
                <Icon name="arrowLeft" size={14} />
                {t("pagination.previous")}
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={{ pathname: "/staff/sync", query: { page: page + 1 } }}
                className="inline-flex h-11 items-center gap-1 rounded-lg border px-3 font-semibold hover:bg-muted md:h-8"
              >
                {t("pagination.next")}
                <Icon name="chevronRight" size={14} />
              </Link>
            )}
          </div>
        </nav>
      )}
    </section>
  );
}
