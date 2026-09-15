import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { FormAlert } from "@/components/forms/form-alert";
import { CopyLinkButton, PrintButton } from "@/components/features/verification/result-actions";
import { ResultCard } from "@/components/features/verification/result-card";
import { RequestStatusBadge } from "@/components/features/verification/request-status-badge";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { REQUESTER_ROLES } from "@/lib/auth/rbac";
import { getRequestDetail } from "@/lib/services/verification.service";
import { appUrl } from "@/lib/utils/app-url";
import { getRequestContext } from "@/lib/utils/request-context";
import { cn } from "@/lib/utils";
import { isRejectReason } from "@/lib/verification/reject-reasons";

// F-VER-07 — รายละเอียดคำขอ + ผลตรวจสอบ (ตาม project-ui/2 · รายละเอียดคำขอและผล)

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/requests/[refNo]">): Promise<Metadata> {
  const { locale, refNo } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "verify.detail" });
  return { title: `${decodeURIComponent(refNo).toUpperCase()} · ${t("resultTitle")}` };
}

export default async function RequestDetailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/requests/[refNo]">) {
  const { locale, refNo } = await params;
  setRequestLocale(locale as AppLocale);
  const user = await requireRole(REQUESTER_ROLES);

  const request = await getRequestDetail(
    user.id,
    decodeURIComponent(refNo),
    await getRequestContext(),
  );
  if (!request) notFound();

  const [t, format, { submitted }] = await Promise.all([
    getTranslations("verify"),
    getFormatter(),
    searchParams,
  ]);
  const dateTime = (value: Date) =>
    format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  const dateOnly = (value: Date) => format.dateTime(value, { dateStyle: "long" });

  const timeline: { icon: IconName; tone: string; title: string; sub: string; time?: string }[] = [
    {
      icon: "fileAdd",
      tone: "bg-primary-soft text-primary",
      title: t("detail.eventSubmitted"),
      sub: t("detail.eventSubmittedSub", { name: request.requester.name }),
      time: dateTime(request.createdAt),
    },
  ];
  if (request.decisionType === "AUTO" && request.decidedAt) {
    timeline.push({
      icon: "shieldCheck",
      tone: "bg-primary-soft text-primary",
      title: t("detail.eventAuto"),
      sub: t("detail.eventAutoSub"),
      time: dateTime(request.decidedAt),
    });
  } else if (request.decisionType === "MANUAL" && request.decidedAt) {
    timeline.push({
      icon: request.status === "APPROVED" ? "checkCircle" : "xCircle",
      tone:
        request.status === "APPROVED"
          ? "bg-primary-soft text-primary"
          : "bg-status-rejected-bg text-status-rejected",
      title: t("detail.eventManual"),
      sub: t("detail.eventManualSub", { name: request.decidedBy?.name ?? "—" }),
      time: dateTime(request.decidedAt),
    });
  } else if (request.status === "PENDING_REVIEW") {
    timeline.push({
      icon: "clock",
      tone: "bg-status-pending-bg text-status-pending",
      title: t("detail.eventReview"),
      sub: t("detail.eventReviewSub"),
    });
  }
  if (request.status === "APPROVED" && request.expiresAt) {
    timeline.push({
      icon: "link",
      tone: "bg-status-info-bg text-status-info",
      title: t("detail.eventLink"),
      sub: t("detail.eventLinkSub", { date: dateOnly(request.expiresAt) }),
    });
  }

  const info = [
    {
      label: t("detail.infoKey"),
      value: `${t(`searchTypes.${request.searchType}`)} ${request.maskedKey}`,
      mono: true,
    },
    { label: t("detail.infoPurpose"), value: t(`purposes.${request.purpose}`) },
    ...(request.requesterReference
      ? [{ label: t("detail.infoReference"), value: request.requesterReference, mono: true }]
      : []),
    { label: t("detail.infoRequester"), value: request.requester.name },
    ...(request.decisionType
      ? [{ label: t("detail.infoDecision"), value: t(`decisions.${request.decisionType}`) }]
      : []),
    { label: t("detail.infoSubmitted"), value: dateTime(request.createdAt) },
  ];

  const permalinkUrl = request.permalinkPath ? appUrl(request.permalinkPath, locale) : null;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/requests"
        className="mb-3.5 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-text-2 hover:text-foreground sm:min-h-0 print:hidden"
      >
        <Icon name="arrowLeft" size={16} />
        {t("detail.backToList")}
      </Link>

      {submitted === "1" && (
        <FormAlert variant="success" className="mb-4 print:hidden">
          {t("detail.submitted", { refNo: request.refNo })}
        </FormAlert>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {request.status === "APPROVED" && request.result ? (
            <ResultCard
              result={request.result}
              meta={[
                request.refNo,
                request.decisionType,
                request.decidedAt ? dateTime(request.decidedAt) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              actions={
                <>
                  <PrintButton label={t("detail.print")} />
                  {permalinkUrl && (
                    <>
                      <CopyLinkButton
                        url={permalinkUrl}
                        label={t("detail.copyLink")}
                        copiedLabel={t("detail.copied")}
                      />
                      <Button
                        asChild
                        variant="outline"
                        className="h-11 w-full font-semibold sm:h-[42px] sm:w-auto print:hidden"
                      >
                        <a href={permalinkUrl} target="_blank" rel="noopener noreferrer">
                          <Icon name="link" size={18} />
                          {t("detail.openPermalink")}
                        </a>
                      </Button>
                    </>
                  )}
                </>
              }
            >
              <p className="mt-3 text-[11.5px] text-muted-foreground print:hidden">
                {permalinkUrl && request.expiresAt
                  ? t("detail.linkExpires", { date: dateOnly(request.expiresAt) })
                  : t("detail.linkExpired")}
              </p>
              <div className="mt-3.5 flex items-start gap-2.5 rounded-[11px] border bg-surface p-3">
                <Icon name="info" size={18} className="mt-px shrink-0 text-status-info" />
                <p className="text-[11.5px] leading-relaxed text-text-2">
                  {t("detail.snapshotNote")}
                </p>
              </div>
            </ResultCard>
          ) : (
            <StatusPanel
              status={request.status}
              refNo={request.refNo}
              badge={t(`statuses.${request.status}`)}
              title={
                request.status === "REJECTED"
                  ? t("detail.rejectedTitle")
                  : request.status === "NOT_FOUND"
                    ? t("detail.notFoundTitle")
                    : t("detail.pendingTitle")
              }
              body={
                request.status === "REJECTED"
                  ? t("detail.rejectedBody")
                  : request.status === "NOT_FOUND"
                    ? t("detail.notFoundBody")
                    : t("detail.pendingBody")
              }
              reason={
                isRejectReason(request.rejectReason)
                  ? {
                      label: t("detail.rejectReason"),
                      value: [t(`rejectReasons.${request.rejectReason}`), request.rejectDetail]
                        .filter(Boolean)
                        .join(" — "),
                    }
                  : null
              }
            />
          )}
        </div>

        <aside className="flex w-full flex-col gap-3.5 lg:w-[312px] lg:flex-none print:hidden">
          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-3.5 text-[13.5px] font-bold">{t("detail.timeline")}</h2>
            <ol>
              {timeline.map((event, index) => (
                <li key={event.title} className="flex gap-3">
                  <div className="flex shrink-0 flex-col items-center">
                    <span
                      className={cn(
                        "flex size-[26px] items-center justify-center rounded-full",
                        event.tone,
                      )}
                    >
                      <Icon name={event.icon} size={14} />
                    </span>
                    {index < timeline.length - 1 && (
                      <span aria-hidden className="min-h-4 w-[1.5px] flex-1 bg-border" />
                    )}
                  </div>
                  <div className="pb-3.5">
                    <p className="text-[12.5px] font-bold">{event.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                      {event.sub}
                    </p>
                    {event.time && (
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {event.time}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-3 text-[13.5px] font-bold">{t("detail.reqInfo")}</h2>
            <dl className="flex flex-col gap-2.5 text-xs">
              {info.map((row) => (
                <div key={row.label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                  <dd
                    className={cn(
                      "min-w-0 text-right font-semibold break-words",
                      "mono" in row && row.mono && "font-mono text-[11.5px]",
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusPanel({
  status,
  refNo,
  badge,
  title,
  body,
  reason,
}: {
  status: "PENDING_REVIEW" | "REJECTED" | "NOT_FOUND" | "DRAFT" | "EXPIRED" | "APPROVED";
  refNo: string;
  badge: string;
  title: string;
  body: string;
  reason: { label: string; value: string } | null;
}) {
  const pending = status === "PENDING_REVIEW";
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium text-primary">{refNo}</span>
        <RequestStatusBadge status={status} label={badge} />
      </div>
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <span
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-2xl",
            pending
              ? "bg-status-pending-bg text-status-pending"
              : "bg-status-notfound-bg text-status-notfound",
          )}
        >
          <Icon name={pending ? "clock" : "xCircle"} size={28} />
        </span>
        <div>
          <h1 className="text-lg font-bold sm:text-xl">{title}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-text-2">{body}</p>
          {reason && (
            <p className="mt-3 rounded-xl border bg-surface p-3 text-[13px]">
              <span className="font-semibold">{reason.label}:</span> {reason.value}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
