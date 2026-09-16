import { getFormatter, getTranslations } from "next-intl/server";
import type { SyncJob } from "@/generated/prisma/client";
import { Icon, type IconName } from "@/components/ui/icon";
import { normalizeSyncErrorCode } from "@/lib/services/sync.service";
import { formatDuration } from "@/lib/utils/duration";
import { cn } from "@/lib/utils";

type Tone = "ok" | "running" | "failed" | "never";

const TONES: Record<Tone, { box: string; icon: IconName; iconClass: string }> = {
  ok: {
    box: "border-status-approved/25 bg-status-approved-bg text-status-approved-tx",
    icon: "checkCircle",
    iconClass: "text-status-approved",
  },
  running: {
    box: "border-status-info/25 bg-status-info-bg text-status-info-tx",
    icon: "loading",
    iconClass: "animate-spin text-status-info",
  },
  failed: {
    box: "border-status-rejected/25 bg-status-rejected-bg text-status-rejected-tx",
    icon: "alert",
    iconClass: "text-status-rejected",
  },
  never: { box: "bg-card text-foreground", icon: "sync", iconClass: "text-primary" },
};

type Props = {
  running: SyncJob | null;
  latest: SyncJob | null;
  lastSuccess: SyncJob | null;
  studentCount: number;
};

export async function SyncStatusBanner({ running, latest, lastSuccess, studentCount }: Props) {
  const [t, format] = await Promise.all([getTranslations("sync"), getFormatter()]);
  const when = (date: Date) =>
    format.dateTime(date, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const counts = (job: SyncJob) => ({
    fetched: format.number(job.recordsFetched),
    upserted: format.number(job.recordsUpserted),
  });

  let tone: Tone;
  let title: string;
  let body: string;
  let note: string | null = null;

  if (running) {
    tone = "running";
    title = t("banner.runningTitle");
    body = t("banner.runningBody", { time: when(running.startedAt), ...counts(running) });
  } else if (!latest) {
    tone = "never";
    title = t("banner.neverTitle");
    body = t("banner.neverBody", { count: format.number(studentCount) });
  } else if (latest.status === "SUCCESS") {
    tone = "ok";
    title = t("banner.okTitle");
    body = t("banner.okBody", {
      type: t(`types.${latest.type}`),
      time: when(latest.finishedAt ?? latest.startedAt),
      duration: formatDuration(
        (latest.finishedAt ?? latest.startedAt).getTime() - latest.startedAt.getTime(),
      ),
      ...counts(latest),
    });
  } else {
    tone = "failed";
    title = t("banner.failedTitle");
    body = t("banner.failedBody", {
      time: when(latest.startedAt),
      reason: t(`errors.${normalizeSyncErrorCode(latest.errorCode)}`),
    });
    note = lastSuccess ? t("banner.lastSuccess", { time: when(lastSuccess.startedAt) }) : null;
  }

  const style = TONES[tone];
  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-[15px] border p-4 sm:gap-3.5 sm:p-4.5",
        style.box,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-card sm:size-[46px] sm:rounded-[13px]">
        <Icon name={style.icon} size={22} className={style.iconClass} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold sm:text-[14.5px]">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed sm:text-xs">{body}</p>
        {note && <p className="mt-0.5 text-[11px] sm:text-xs">{note}</p>}
      </div>
    </section>
  );
}
