"use client";

import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { approveRequestAction } from "@/actions/review";
import { useTranslateKey } from "@/components/forms/translated-form-message";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { RefreshStudentButton } from "./staff-controls";
import { STUDENT_STATUS_TONE, StatusPill } from "./status-pill";

// F-REG-02 / F-REG-03 / F-REG-04 — พื้นที่ตัดสินคำขอ: เลือกระเบียน → ดูผลที่จะเกิด → อนุมัติ
// ระเบียนมาจากการจับคู่อัตโนมัติ (hash คีย์ค้นหา) และจากการค้นหาด้วยตนเอง (?search=)

export type CandidateSummary = {
  id: string;
  studentCode: string;
  name: string;
  nameAlt: string | null;
  status: keyof typeof STUDENT_STATUS_TONE;
  statusLabel: string;
  flagged: boolean;
  fields: { label: string; value: string; mono?: boolean }[];
  sourceAt: string;
};

export type WorkspaceLabels = {
  approve: string;
  approving: string;
  matches: string;
  noMatches: string;
  manualSearch: string;
  manualSearchPh: string;
  search: string;
  searchResults: string;
  searchEmpty: string;
  refreshOne: string;
  refreshing: string;
  openStudent: string;
  flagged: string;
  decisionPreview: string;
  willApprove: string;
  willApproveBody: string;
  selectFirst: string;
  selectFirstBody: string;
  warnNotGraduated: string;
  warnFlagged: string;
};

function CandidateCard({
  candidate,
  selected,
  onSelect,
  labels,
}: {
  candidate: CandidateSummary;
  selected: boolean;
  onSelect: () => void;
  labels: WorkspaceLabels;
}) {
  return (
    <div
      className={cn(
        "rounded-[13px] border p-3.5 transition-colors sm:p-4",
        selected ? "border-[1.5px] border-primary bg-primary-soft/60 shadow-sm" : "bg-card",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="radio"
          name="studentId"
          value={candidate.id}
          checked={selected}
          onChange={onSelect}
          className="mt-1 size-5 shrink-0 accent-primary"
        />
        <span className="min-w-0 flex-1">
          <span className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold">{candidate.name}</span>
            <StatusPill
              tone={STUDENT_STATUS_TONE[candidate.status]}
              label={candidate.statusLabel}
            />
            {candidate.flagged && (
              <StatusPill tone="rejected" icon="alert" label={labels.flagged} />
            )}
            <span className="font-mono text-[11px] text-muted-foreground">
              {candidate.studentCode}
            </span>
          </span>
          {candidate.nameAlt && (
            <span className="-mt-1 mb-2 block text-[11.5px] text-muted-foreground">
              {candidate.nameAlt}
            </span>
          )}
          <span className="grid gap-2 sm:grid-cols-2">
            {candidate.fields.map((field) => (
              <span key={field.label} className="block">
                <span className="block text-[10.5px] text-muted-foreground">{field.label}</span>
                <span
                  className={cn(
                    "mt-px block text-[12.5px] font-semibold",
                    field.mono && "font-mono",
                  )}
                >
                  {field.value}
                </span>
              </span>
            ))}
          </span>
        </span>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-8">
        <RefreshStudentButton
          studentCode={candidate.studentCode}
          label={labels.refreshOne}
          pendingLabel={labels.refreshing}
        />
        <Button asChild variant="outline" size="sm" className="h-11 font-semibold sm:h-8">
          <Link href={`/staff/students/${candidate.studentCode}`}>
            <Icon name="graduation" size={14} />
            {labels.openStudent}
          </Link>
        </Button>
        {candidate.sourceAt && (
          <span className="font-mono text-[10.5px] text-muted-foreground sm:ml-auto">
            {candidate.sourceAt}
          </span>
        )}
      </div>
    </div>
  );
}

export function ReviewWorkspace({
  refNo,
  header,
  secondaryActions,
  requestPanel,
  candidates,
  searchResults,
  searchQuery,
  labels,
}: {
  refNo: string;
  header: ReactNode;
  secondaryActions: ReactNode;
  requestPanel: ReactNode;
  candidates: CandidateSummary[];
  searchResults: CandidateSummary[];
  searchQuery: string;
  labels: WorkspaceLabels;
}) {
  const translate = useTranslateKey();
  const [pending, startTransition] = useTransition();
  // ค่าเริ่มต้น = ระเบียนแรกที่สำเร็จการศึกษาและไม่ติดธง (ถ้ามี)
  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      candidates.find((c) => c.status === "GRADUATED" && !c.flagged)?.id ??
      candidates[0]?.id ??
      null,
  );
  const selected =
    candidates.find((c) => c.id === selectedId) ?? searchResults.find((c) => c.id === selectedId);

  function approve() {
    if (!selected) return;
    startTransition(async () => {
      const result = await approveRequestAction({ refNo, studentId: selected.id });
      if (result.ok) toast.success(translate(result.message ?? "review.approved"));
      else toast.error(translate(result.error ?? "review.errors.notFound"));
    });
  }

  const extraResults = searchResults.filter((r) => !candidates.some((c) => c.id === r.id));
  const warnings = selected
    ? [
        ...(selected.status !== "GRADUATED" ? [labels.warnNotGraduated] : []),
        ...(selected.flagged ? [labels.warnFlagged] : []),
      ]
    : [];

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        {header}
        <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
          {secondaryActions}
          <Button
            type="button"
            onClick={approve}
            disabled={!selected || pending}
            className="h-11 px-5 font-bold sm:h-[42px]"
          >
            <Icon
              name={pending ? "loading" : "check"}
              size={18}
              className={pending ? "animate-spin" : ""}
            />
            {pending ? labels.approving : labels.approve}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-col gap-3.5 lg:flex-1">{requestPanel}</div>

        <div className="flex min-w-0 flex-col gap-3.5 lg:flex-[1.15]">
          <section className="overflow-hidden rounded-[15px] border bg-card">
            <div className="flex items-center gap-2 border-b px-4.5 py-3.5">
              <h2 className="text-[14.5px] font-bold">{labels.matches}</h2>
              <span className="rounded-full bg-status-pending-bg px-2 py-0.5 font-mono text-[10.5px] font-bold text-status-pending-tx">
                {candidates.length}
              </span>
            </div>
            <div className="flex flex-col gap-3 p-3.5 sm:p-4">
              {candidates.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-[12.5px] text-muted-foreground">
                  {labels.noMatches}
                </p>
              ) : (
                candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    selected={candidate.id === selectedId}
                    onSelect={() => setSelectedId(candidate.id)}
                    labels={labels}
                  />
                ))
              )}

              <form role="search" className="flex flex-col gap-2 border-t pt-3.5 sm:flex-row">
                <label htmlFor="manual-search" className="sr-only">
                  {labels.manualSearch}
                </label>
                <div className="relative flex-1">
                  <Icon
                    name="search"
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="manual-search"
                    name="search"
                    defaultValue={searchQuery}
                    maxLength={100}
                    placeholder={labels.manualSearchPh}
                    className="h-11 pl-9 sm:h-9"
                  />
                </div>
                <Button type="submit" variant="outline" className="h-11 font-semibold sm:h-9">
                  {labels.manualSearch}
                </Button>
              </form>

              {searchQuery && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-bold text-muted-foreground">{labels.searchResults}</p>
                  {extraResults.length === 0 ? (
                    <p className="text-[12.5px] text-muted-foreground">{labels.searchEmpty}</p>
                  ) : (
                    extraResults.map((candidate) => (
                      <CandidateCard
                        key={candidate.id}
                        candidate={candidate}
                        selected={candidate.id === selectedId}
                        onSelect={() => setSelectedId(candidate.id)}
                        labels={labels}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[15px] border bg-card p-4.5" aria-live="polite">
            <h2 className="mb-3 text-xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
              {labels.decisionPreview}
            </h2>
            {selected ? (
              <div className="flex items-start gap-3 rounded-xl border border-status-approved/25 bg-status-approved-bg p-3.5 text-status-approved-tx">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-card">
                  <Icon name="shieldCheck" size={20} className="text-status-approved" />
                </span>
                <div>
                  <p className="text-[13px] font-bold">
                    {labels.willApprove.replace("{code}", selected.studentCode)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed opacity-90">
                    {labels.willApproveBody}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-3.5">
                <p className="text-[13px] font-bold">{labels.selectFirst}</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {labels.selectFirstBody}
                </p>
              </div>
            )}
            {warnings.map((warning) => (
              <p
                key={warning}
                role="alert"
                className="mt-2.5 flex items-start gap-2 rounded-[10px] border border-status-rejected/25 bg-status-rejected-bg p-2.5 text-[12px] text-status-rejected-tx"
              >
                <Icon name="alert" size={16} className="mt-px shrink-0" />
                {warning}
              </p>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
