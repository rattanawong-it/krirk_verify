import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { revealStudentIdAction } from "@/actions/review";
import { RefreshStudentButton, RevealButton } from "@/components/features/staff/staff-controls";
import { STUDENT_STATUS_TONE, StatusPill } from "@/components/features/staff/status-pill";
import { RequestStatusBadge } from "@/components/features/verification/request-status-badge";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import { getStudentDetail } from "@/lib/services/student.service";
import { getRequestContext } from "@/lib/utils/request-context";
import { cn } from "@/lib/utils";
import {
  degreeLabel,
  fullNameEn,
  fullNameTh,
  graduationTermLabel,
} from "@/lib/verification/display";

// F-REG-07 — รายละเอียดระเบียนผู้สำเร็จการศึกษา + ดึงข้อมูลรายคน (F-DATA-09)

const LEVELS = ["BACHELOR", "MASTER", "DOCTORAL"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/staff/students/[studentCode]">): Promise<Metadata> {
  const { locale, studentCode } = await params;
  const t = await getTranslations({ locale: locale as AppLocale, namespace: "students" });
  return { title: `${studentCode} · ${t("title")}` };
}

type Row = { label: string; value: ReactNode; mono?: boolean };

function InfoGrid({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-[13px] border bg-border sm:grid-cols-2">
      {rows.map((row, index) => (
        <div
          key={row.label}
          // จำนวนช่องคี่ → ช่องสุดท้ายเต็มแถว ไม่เหลือช่องว่าง
          className={cn(
            "bg-card px-3.5 py-3",
            rows.length % 2 === 1 && index === rows.length - 1 && "sm:col-span-2",
          )}
        >
          <dt className="mb-0.5 text-[11px] text-muted-foreground">{row.label}</dt>
          <dd className={cn("text-[13.5px] font-semibold break-words", row.mono && "font-mono")}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function StudentDetailPage({
  params,
}: PageProps<"/[locale]/staff/students/[studentCode]">) {
  const { locale, studentCode } = await params;
  setRequestLocale(locale as AppLocale);
  const staff = await requireRole(STAFF_ROLES);

  const student = await getStudentDetail(studentCode, staff, await getRequestContext());
  if (!student) notFound();

  const [t, tr, tv, format, currentLocale] = await Promise.all([
    getTranslations("students"),
    getTranslations("review"),
    getTranslations("verify"),
    getFormatter(),
    getLocale(),
  ]);
  const dateLong = (value: Date | null) =>
    value ? format.dateTime(value, { dateStyle: "long", timeZone: "UTC" }) : "—";
  const dateTime = (value: Date | null) =>
    value ? format.dateTime(value, { dateStyle: "medium", timeStyle: "short" }) : "—";
  const level = LEVELS.find((l) => l === student.educationLevel);
  const reveal = (field: "citizenId" | "passportNo", masked: string) => (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono">{masked}</span>
      <RevealButton
        action={revealStudentIdAction.bind(null, student.studentCode, field)}
        label={tr("revealId")}
        pendingLabel={tr("revealing")}
        failedLabel={tr("revealFailed")}
      />
    </span>
  );

  const identity: Row[] = [
    { label: t("nameTh"), value: fullNameTh(student) },
    { label: t("nameEn"), value: fullNameEn(student) ?? "—" },
    { label: tv("result.studentCode"), value: student.studentCode, mono: true },
    ...(student.maskedCitizenId
      ? [{ label: t("citizenId"), value: reveal("citizenId", student.maskedCitizenId) }]
      : []),
    ...(student.maskedPassportNo
      ? [{ label: t("passportNo"), value: reveal("passportNo", student.maskedPassportNo) }]
      : []),
  ];
  const education: Row[] = [
    {
      label: tv("result.educationLevel"),
      value: level ? tv(`levels.${level}`) : student.educationLevel,
    },
    { label: tv("result.degree"), value: degreeLabel(student, currentLocale) },
    {
      label: t("program"),
      value: currentLocale === "en" ? (student.programEn ?? student.programTh) : student.programTh,
    },
    {
      label: tv("result.faculty"),
      value: currentLocale === "en" ? (student.facultyEn ?? student.facultyTh) : student.facultyTh,
    },
    student.graduationDate || !student.graduationTerm
      ? { label: tv("result.graduationDate"), value: dateLong(student.graduationDate) }
      : {
          label: tv("result.graduationTerm"),
          value: graduationTermLabel(student.graduationTerm, currentLocale) ?? "—",
        },
    { label: tv("result.councilApprovalDate"), value: dateLong(student.councilApprovalDate) },
    { label: tv("result.gpa"), value: student.gpa ? student.gpa.toFixed(2) : "—", mono: true },
    { label: tv("result.honors"), value: student.honors ? tv(`honors.${student.honors}`) : "—" },
    ...(student.registryStatus
      ? [{ label: tv("result.registryStatus"), value: student.registryStatus }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/staff/students"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-text-2 hover:text-foreground sm:min-h-0"
      >
        <Icon name="arrowLeft" size={16} />
        {t("backToList")}
      </Link>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{fullNameTh(student)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-[7px] bg-primary-soft px-2.5 py-1 font-mono text-[12.5px] font-medium text-primary">
              {student.studentCode}
            </span>
            <StatusPill
              tone={STUDENT_STATUS_TONE[student.status]}
              label={tv(`studentStatuses.${student.status}`)}
            />
            {student.requiresManualReview && (
              <StatusPill tone="rejected" icon="alert" label={t("flag")} />
            )}
          </div>
        </div>
        <RefreshStudentButton
          studentCode={student.studentCode}
          label={t("refresh")}
          pendingLabel={tr("refreshing")}
          className="sm:h-[38px]"
        />
      </div>

      <p className="mb-4 flex items-start gap-2.5 rounded-[13px] border border-gold/40 bg-gold-soft p-3.5 text-xs leading-relaxed text-[#6b4e0a] dark:text-gold">
        <Icon name="lock" size={18} className="shrink-0 text-gold" />
        {t("pdpa")}
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="rounded-[15px] border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-[14px] font-bold">{t("identity")}</h2>
            <InfoGrid rows={identity} />
          </section>
          <section className="rounded-[15px] border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-[14px] font-bold">{t("education")}</h2>
            <InfoGrid rows={education} />
          </section>
        </div>

        <aside className="flex w-full flex-col gap-3.5 lg:w-[320px] lg:flex-none">
          <section className="rounded-[15px] border bg-card p-4.5">
            <h2 className="mb-3 text-[13.5px] font-bold">{t("syncInfo")}</h2>
            <dl className="flex flex-col gap-2.5 text-xs">
              {[
                { label: t("sourceUpdatedAt"), value: dateTime(student.sourceUpdatedAt) },
                { label: t("syncedAt"), value: dateTime(student.syncedAt) },
                { label: t("flag"), value: student.requiresManualReview ? t("yes") : t("no") },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right font-semibold">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="overflow-hidden rounded-[15px] border bg-card">
            <h2 className="border-b px-4.5 py-3 text-[13.5px] font-bold">{t("requests")}</h2>
            {student.requests.length === 0 ? (
              <p className="px-4.5 py-6 text-center text-xs text-muted-foreground">
                {t("noRequests")}
              </p>
            ) : (
              <ul className="flex flex-col gap-px bg-border">
                {student.requests.map((request) => (
                  <li key={request.refNo}>
                    <Link
                      href={`/staff/queue/${request.refNo}`}
                      className="block bg-card px-4.5 py-3 hover:bg-surface"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11.5px] font-medium text-primary">
                          {request.refNo}
                        </span>
                        <RequestStatusBadge
                          status={request.status}
                          label={tv(`statuses.${request.status}`)}
                          compact
                        />
                      </span>
                      <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
                        {request.organization
                          ? currentLocale === "en"
                            ? (request.organization.nameEn ?? request.organization.nameTh)
                            : request.organization.nameTh
                          : request.requester.name}{" "}
                        · {dateTime(request.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
