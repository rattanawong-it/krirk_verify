import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import type { Student } from "@/generated/prisma/client";
import { revealRequestKeyAction } from "@/actions/review";
import { ResultCard } from "@/components/features/verification/result-card";
import { RequestStatusBadge } from "@/components/features/verification/request-status-badge";
import { NoteDialog, RejectDialog } from "@/components/features/staff/review-dialogs";
import {
  type CandidateSummary,
  ReviewWorkspace,
} from "@/components/features/staff/review-workspace";
import { RevealButton } from "@/components/features/staff/staff-controls";
import { REVIEW_REASON_STYLE, StatusPill } from "@/components/features/staff/status-pill";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import { maskIp } from "@/lib/email/templates";
import { type ReviewDetail, getReviewDetail } from "@/lib/services/review.service";
import { findStudentsForMatching } from "@/lib/services/student.service";
import { getRequestContext } from "@/lib/utils/request-context";
import { cn } from "@/lib/utils";
import { degreeLabel, displayName, fullNameEn, fullNameTh } from "@/lib/verification/display";
import { REJECT_REASONS, isRejectReason } from "@/lib/verification/reject-reasons";
import { slaLevel, waitParts } from "@/lib/verification/sla";
import { getSettings } from "@/lib/services/settings.service";

// F-REG-02 ถึง F-REG-06 — หน้าพิจารณาคำขอ (ตาม project-ui/3 · หน้าพิจารณาคำขอ แบบสองคอลัมน์)

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/queue/[refNo]">): Promise<Metadata> {
  const { locale, refNo } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "review" });
  return { title: `${decodeURIComponent(refNo).toUpperCase()} · ${t("reviewTitle")}` };
}

const EVENTS: Record<string, { key: EventKey; icon: IconName; tone: string }> = {
  "verification.submitted": {
    key: "submitted",
    icon: "fileAdd",
    tone: "bg-primary-soft text-primary",
  },
  "verification.review.viewed": {
    key: "reviewViewed",
    icon: "eye",
    tone: "bg-status-notfound-bg text-status-notfound",
  },
  "personal_data.revealed": { key: "revealed", icon: "key", tone: "bg-gold-soft text-gold" },
  "verification.note.added": { key: "noteAdded", icon: "doc", tone: "bg-gold-soft text-gold" },
  "verification.approved": {
    key: "approved",
    icon: "checkCircle",
    tone: "bg-primary-soft text-primary",
  },
  "verification.rejected": {
    key: "rejected",
    icon: "xCircle",
    tone: "bg-status-rejected-bg text-status-rejected",
  },
  "verification.result.viewed": {
    key: "resultViewed",
    icon: "eye",
    tone: "bg-status-info-bg text-status-info",
  },
  "verification.permalink.denied": {
    key: "permalinkDenied",
    icon: "shield",
    tone: "bg-status-rejected-bg text-status-rejected",
  },
};

type EventKey =
  | "submitted"
  | "reviewViewed"
  | "revealed"
  | "noteAdded"
  | "approved"
  | "rejected"
  | "resultViewed"
  | "permalinkDenied"
  | "other";

// การเปิดหน้าซ้ำโดยคนเดิมภายใน 30 นาทีรวมเป็นเหตุการณ์เดียว เพื่อให้อ่านไทม์ไลน์ได้
function collapseViews(activity: ReviewDetail["activity"]) {
  const lastView = new Map<string, number>();
  return activity.filter((event) => {
    if (event.action !== "verification.review.viewed") return true;
    const actor = event.actor?.name ?? "";
    const previous = lastView.get(actor);
    lastView.set(actor, event.createdAt.getTime());
    return previous === undefined || event.createdAt.getTime() - previous > 30 * 60_000;
  });
}

function browserOf(userAgent: string | null): string {
  const match = userAgent?.match(/(Edg|OPR|Chrome|Firefox|Safari)\/(\d+)/);
  if (!match) return "—";
  const name = { Edg: "Edge", OPR: "Opera" }[match[1]!] ?? match[1];
  return `${name} ${match[2]}`;
}

export default async function ReviewPage({
  params,
  searchParams,
}: PageProps<"/[locale]/staff/queue/[refNo]">) {
  const { locale, refNo } = await params;
  setRequestLocale(locale as AppLocale);
  const staff = await requireRole(STAFF_ROLES);
  const context = await getRequestContext();

  const detail = await getReviewDetail(decodeURIComponent(refNo), staff, context);
  if (!detail) notFound();

  const { search } = await searchParams;
  const searchQuery = typeof search === "string" ? search.trim().slice(0, 100) : "";
  const pending = detail.status === "PENDING_REVIEW";

  const [t, tv, format, currentLocale, searchResults] = await Promise.all([
    getTranslations("review"),
    getTranslations("verify"),
    getFormatter(),
    getLocale(),
    pending && searchQuery ? findStudentsForMatching(searchQuery, staff, context) : [],
  ]);

  const now = new Date();
  const dateTime = (value: Date) =>
    format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  const dateLong = (value: Date | null) =>
    value ? format.dateTime(value, { dateStyle: "long", timeZone: "UTC" }) : "—";

  const summarize = (s: Student): CandidateSummary => ({
    id: s.id,
    studentCode: s.studentCode,
    name: displayName(s, currentLocale),
    nameAlt: currentLocale === "en" ? fullNameTh(s) : fullNameEn(s),
    status: s.status,
    statusLabel: tv(`studentStatuses.${s.status}`),
    flagged: s.requiresManualReview,
    fields: [
      { label: t("field.program"), value: degreeLabel(s, currentLocale) },
      {
        label: t("field.faculty"),
        value: currentLocale === "en" ? (s.facultyEn ?? s.facultyTh) : s.facultyTh,
      },
      { label: t("field.graduated"), value: dateLong(s.graduationDate) },
      { label: t("field.council"), value: dateLong(s.councilApprovalDate) },
      { label: t("field.gpa"), value: s.gpa ? s.gpa.toFixed(2) : "—", mono: true },
      { label: t("field.honors"), value: s.honors ? tv(`honors.${s.honors}`) : "—" },
    ],
    sourceAt: s.sourceUpdatedAt ? t("sourceUpdated", { time: dateTime(s.sourceUpdatedAt) }) : "",
  });

  const orgName = detail.organization
    ? currentLocale === "en"
      ? (detail.organization.nameEn ?? detail.organization.nameTh)
      : detail.organization.nameTh
    : null;
  const waited = waitParts(now.getTime() - detail.createdAt.getTime());
  const level = slaLevel(detail.createdAt, now, (await getSettings()).slaHours);
  const reasonStyle = detail.reviewReason ? REVIEW_REASON_STYLE[detail.reviewReason] : null;

  const header = (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <h1 className="text-[22px] font-bold tracking-tight">{t("reviewTitle")}</h1>
        <span className="rounded-[7px] bg-primary-soft px-2.5 py-1 font-mono text-[12.5px] font-medium text-primary">
          {detail.refNo}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pending ? (
          <StatusPill
            tone={level === "over" ? "rejected" : "pending"}
            icon="clock"
            label={t("waited", waited)}
          />
        ) : (
          <RequestStatusBadge status={detail.status} label={tv(`statuses.${detail.status}`)} />
        )}
        {detail.reviewReason && reasonStyle && (
          <StatusPill
            tone={reasonStyle.tone}
            icon={reasonStyle.icon}
            label={t(`reasonShort.${detail.reviewReason}`)}
          />
        )}
        {!pending && detail.decisionType && detail.decidedAt && (
          <span className="text-xs text-muted-foreground">
            {t("decidedBy", {
              decision: tv(`decisions.${detail.decisionType}`),
              name: detail.decidedBy?.name ?? t("system"),
              time: dateTime(detail.decidedAt),
            })}
          </span>
        )}
      </div>
    </div>
  );

  const infoRows: { label: string; value: ReactNode; mono?: boolean }[] = [
    ...(orgName ? [{ label: t("info.organization"), value: orgName }] : []),
    {
      label: t("info.requester"),
      value: (
        <>
          {detail.requester.name}
          <span className="block text-[11.5px] font-normal text-muted-foreground">
            {detail.requester.email}
          </span>
        </>
      ),
    },
    {
      label: t("info.key"),
      value: (
        <span className="inline-flex items-center gap-1.5">
          {tv(`searchTypes.${detail.searchType}`)} {detail.maskedKey}
          <Icon name="lock" size={14} className="text-gold" />
        </span>
      ),
      mono: true,
    },
    { label: t("info.purpose"), value: tv(`purposes.${detail.purpose}`) },
    ...(detail.requesterReference
      ? [{ label: t("info.reference"), value: detail.requesterReference, mono: true }]
      : []),
    { label: t("info.consent"), value: dateTime(detail.consentAt) },
    {
      label: t("info.submittedFrom"),
      value: `${maskIp(detail.ipAddress)} · ${browserOf(detail.userAgent)}`,
      mono: true,
    },
  ];

  const requestPanel = (
    <>
      <section className="rounded-[15px] border bg-card p-4.5">
        <h2 className="mb-3.5 text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
          {t("requestInfo")}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {infoRows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="mb-0.5 text-[11px] text-muted-foreground">{row.label}</dt>
              <dd
                className={cn(
                  "text-[13.5px] font-semibold break-words",
                  row.mono && "font-mono text-[12.5px]",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {detail.note && (
          <div className="mt-3.5 rounded-[11px] border bg-surface p-3">
            <p className="text-[11px] text-muted-foreground">{t("info.note")}</p>
            <p className="mt-0.5 text-[13px] whitespace-pre-line">{detail.note}</p>
          </div>
        )}
        {detail.anonymizedAt ? (
          // F-AUD-08 — ข้อมูลส่วนบุคคลของคำขอนี้ถูกลบตามนโยบายเก็บรักษาแล้ว
          <div className="mt-3.5 flex items-start gap-2.5 rounded-[11px] border bg-surface p-3">
            <Icon name="history" size={18} className="mt-px shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[12.5px] font-bold">{t("anonymizedTitle")}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-2">
                {t("anonymizedBody", { date: dateTime(detail.anonymizedAt) })}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3.5 flex flex-col gap-2.5 rounded-[11px] border border-gold/40 bg-gold-soft p-3 sm:flex-row sm:items-center">
            <Icon name="lock" size={18} className="hidden shrink-0 text-gold sm:block" />
            <p className="flex-1 text-[11.5px] leading-relaxed text-[#6b4e0a] dark:text-gold">
              {t("revealNote")}
            </p>
            <RevealButton
              action={revealRequestKeyAction.bind(null, detail.refNo)}
              label={t("revealId")}
              pendingLabel={t("revealing")}
              failedLabel={t("revealFailed")}
            />
          </div>
        )}
      </section>

      {detail.reviewReason && (
        <section className="rounded-[15px] border bg-card p-4.5">
          <h2 className="mb-3 text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
            {t("whyQueued")}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {[
              {
                icon: reasonStyle?.icon ?? "alert",
                tone: "border-status-pending/25 bg-status-pending-bg text-status-pending-tx",
                title: t(`reasons.${detail.reviewReason}.title`),
                sub: t(`reasons.${detail.reviewReason}.sub`),
              },
              {
                icon: "info" as const,
                tone: "border-status-info/25 bg-status-info-bg text-status-info-tx",
                title: t("ruleTitle"),
                sub: t("ruleSub"),
              },
              ...(pending
                ? [
                    {
                      icon: "shield" as const,
                      tone: "border-border bg-surface text-text-2",
                      title: t("hiddenTitle"),
                      sub: t("hiddenSub"),
                    },
                  ]
                : []),
            ].map((item) => (
              <li
                key={item.title}
                className={cn("flex items-start gap-2.5 rounded-[11px] border p-3", item.tone)}
              >
                <Icon name={item.icon} size={18} className="mt-px shrink-0" />
                <div>
                  <p className="text-[12.5px] font-bold">{item.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-85">{item.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  const noteDialog = (
    <NoteDialog
      refNo={detail.refNo}
      labels={{
        trigger: t("internalNote"),
        title: t("noteTitle"),
        sub: t("noteSub"),
        placeholder: t("notePh"),
        save: t("saveNote"),
        saving: t("saving"),
        cancel: t("cancel"),
      }}
    />
  );

  // ไทม์ไลน์: audit log ของคำขอ + เนื้อหาหมายเหตุภายใน
  const notesById = new Map(detail.notes.map((note) => [note.id, note]));
  const activity = collapseViews(detail.activity).map((event) => {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const style = EVENTS[event.action] ?? {
      key: "other" as const,
      icon: "circle" as const,
      tone: "bg-muted text-muted-foreground",
    };
    let body: string | null = null;
    if (event.action === "verification.note.added") {
      body = notesById.get(String(meta.noteId))?.body ?? null;
    } else if (event.action === "verification.approved" && typeof meta.studentCode === "string") {
      body = meta.studentCode;
    } else if (event.action === "verification.rejected" && isRejectReason(meta.reason)) {
      body = tv(`rejectReasons.${meta.reason}`);
    } else if (event.action === "verification.submitted") {
      body = `${tv(`purposes.${detail.purpose}`)} · ${maskIp(event.ipAddress)}`;
    }
    return { ...event, ...style, body };
  });

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/staff/queue"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-text-2 hover:text-foreground sm:min-h-0"
      >
        <Icon name="arrowLeft" size={16} />
        {t("backToQueue")}
      </Link>

      {pending ? (
        <ReviewWorkspace
          refNo={detail.refNo}
          header={header}
          secondaryActions={
            <>
              {noteDialog}
              <RejectDialog
                refNo={detail.refNo}
                labels={{
                  trigger: t("reject"),
                  title: t("rejectTitle", { refNo: detail.refNo }),
                  sub: t("rejectSub"),
                  reason: t("rejectReason"),
                  detail: t("rejectDetail"),
                  detailPh: t("rejectDetailPh"),
                  notFoundHint: t("rejectNotFoundHint"),
                  confirm: t("confirmReject"),
                  saving: t("saving"),
                  cancel: t("cancel"),
                  reasons: Object.fromEntries(
                    REJECT_REASONS.map((reason) => [reason, tv(`rejectReasons.${reason}`)]),
                  ) as Record<(typeof REJECT_REASONS)[number], string>,
                }}
              />
            </>
          }
          requestPanel={requestPanel}
          candidates={detail.candidates.map(summarize)}
          searchResults={searchResults.map(summarize)}
          searchQuery={searchQuery}
          labels={{
            approve: t("approve"),
            approving: t("approving"),
            matches: t("matches"),
            noMatches: t("noMatches"),
            manualSearch: t("manualSearch"),
            manualSearchPh: t("manualSearchPh"),
            search: t("search"),
            searchResults: t("searchResults"),
            searchEmpty: t("searchEmpty"),
            refreshOne: t("refreshOne"),
            refreshing: t("refreshing"),
            openStudent: t("openStudent"),
            flagged: t("flagged"),
            decisionPreview: t("decisionPreview"),
            willApprove: t("willApprove", { code: "{code}" }),
            willApproveBody: t("willApproveBody"),
            selectFirst: t("selectFirst"),
            selectFirstBody: t("selectFirstBody"),
            warnNotGraduated: t("warnNotGraduated"),
            warnFlagged: t("warnFlagged"),
          }}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            {header}
            <div className="flex gap-2">{noteDialog}</div>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-col gap-3.5 lg:flex-1">{requestPanel}</div>
            <div className="min-w-0 lg:flex-[1.15]">
              {detail.status === "APPROVED" && detail.result ? (
                <ResultCard
                  result={detail.result}
                  meta={[
                    detail.refNo,
                    detail.decisionType,
                    detail.decidedAt ? dateTime(detail.decidedAt) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ) : (
                <section className="rounded-2xl border bg-card p-5 sm:p-6">
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    <Icon name="xCircle" size={20} className="text-status-rejected" />
                    {t("decidedTitle")}
                  </h2>
                  {isRejectReason(detail.rejectReason) && (
                    <p className="mt-3 rounded-xl border bg-surface p-3 text-[13px]">
                      <span className="font-semibold">{t("rejectReason")}:</span>{" "}
                      {tv(`rejectReasons.${detail.rejectReason}`)}
                      {detail.rejectDetail && (
                        <span className="mt-1 block text-text-2">{detail.rejectDetail}</span>
                      )}
                    </p>
                  )}
                </section>
              )}
            </div>
          </div>
        </>
      )}

      <section className="mt-4 overflow-hidden rounded-[15px] border bg-card">
        <div className="flex flex-col gap-1 border-b px-4.5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-[14.5px] font-bold">
            <Icon name="history" size={18} className="text-text-2" />
            {t("activityTitle")}
          </h2>
          <span className="text-[11px] text-muted-foreground">{t("activityNote")}</span>
        </div>
        <ol className="px-4 pt-4 pb-1 sm:px-4.5">
          {activity.map((event, index) => (
            <li
              key={event.id}
              className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 sm:grid-cols-[150px_30px_minmax(0,1fr)]"
            >
              <p className="hidden pt-1.5 text-right font-mono text-[11px] text-muted-foreground sm:block">
                {dateTime(event.createdAt)}
              </p>
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-[30px] shrink-0 items-center justify-center rounded-[9px]",
                    event.tone,
                  )}
                >
                  <Icon name={event.icon} size={14} />
                </span>
                {index < activity.length - 1 && (
                  <span aria-hidden className="w-[1.5px] flex-1 bg-border" />
                )}
              </div>
              <div className="pt-1 pb-4">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold">{t(`events.${event.key}`)}</span>
                  <span className="rounded-[5px] bg-muted px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-muted-foreground">
                    {event.actor?.name ?? t("system")}
                  </span>
                </p>
                {event.body && (
                  <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-text-2">
                    {event.body}
                  </p>
                )}
                <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground sm:hidden">
                  {dateTime(event.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
