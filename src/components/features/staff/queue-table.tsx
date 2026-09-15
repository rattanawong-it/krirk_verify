"use client";

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { SlaLevel } from "@/lib/verification/sla";
import { cn } from "@/lib/utils";
import { REVIEW_REASON_STYLE, StatusPill } from "./status-pill";

// F-REG-01 — ตารางคิว (TanStack Table v8) · กรอง/เรียง/แบ่งหน้าทำฝั่ง server ผ่าน URL
// ข้อความทั้งหมดแปลมาจาก server แล้ว เพื่อไม่ต้องส่ง messages ทั้งก้อนมาที่ client

export type QueueTableRow = {
  refNo: string;
  requesterName: string;
  requesterEmail: string;
  organizationName: string | null;
  maskedKey: string;
  reason: keyof typeof REVIEW_REASON_STYLE | null;
  reasonLabel: string;
  wait: string;
  sla: SlaLevel;
  slaLabel: string;
};

type Labels = { ref: string; requester: string; key: string; reason: string; wait: string };

const SLA_ROW: Record<SlaLevel, string> = {
  ok: "border-l-transparent",
  warn: "border-l-status-pending bg-status-pending-bg/35",
  over: "border-l-status-rejected bg-status-rejected-bg/35",
};

const SLA_TEXT: Record<SlaLevel, string> = {
  ok: "text-text-2",
  warn: "text-status-pending-tx",
  over: "text-status-rejected-tx",
};

function ReasonBadge({ row, compact }: { row: QueueTableRow; compact?: boolean }) {
  const style = row.reason ? REVIEW_REASON_STYLE[row.reason] : null;
  return (
    <StatusPill
      tone={style?.tone ?? "expired"}
      icon={style?.icon}
      label={row.reasonLabel}
      compact={compact}
    />
  );
}

export function QueueTable({ rows, labels }: { rows: QueueTableRow[]; labels: Labels }) {
  const columns = useMemo<ColumnDef<QueueTableRow>[]>(
    () => [
      {
        id: "ref",
        header: labels.ref,
        cell: ({ row }) => (
          <Link
            href={`/staff/queue/${row.original.refNo}`}
            className="font-mono text-xs font-medium text-primary after:absolute after:inset-0 hover:underline"
          >
            {row.original.refNo}
          </Link>
        ),
      },
      {
        id: "requester",
        header: labels.requester,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold">
              {row.original.organizationName ?? row.original.requesterName}
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
              {row.original.requesterEmail}
            </p>
          </div>
        ),
      },
      {
        id: "key",
        header: labels.key,
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-text-2">{row.original.maskedKey}</span>
        ),
      },
      {
        id: "reason",
        header: labels.reason,
        cell: ({ row }) => <ReasonBadge row={row.original} />,
      },
      {
        id: "wait",
        header: labels.wait,
        cell: ({ row }) => (
          <div className={SLA_TEXT[row.original.sla]}>
            <p className="font-mono text-[11.5px] font-medium">{row.original.wait}</p>
            <p className="text-[9.5px] opacity-80">{row.original.slaLabel}</p>
          </div>
        ),
      },
    ],
    [labels],
  );

  // React Compiler ข้ามการ memo ของ TanStack Table v8 (ตามที่ไลบรารีแนะนำ) — ตารางนี้ไม่ได้ส่งค่าให้ component ที่ memo อยู่
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="border-b bg-surface text-[11.5px] font-bold text-text-2">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} scope="col" className="px-3 py-2.5 font-bold first:pl-4.5">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                <th scope="col" className="w-10" />
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "relative border-b border-l-[3px] last:border-b-0 hover:bg-surface",
                  SLA_ROW[row.original.sla],
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="max-w-[260px] px-3 py-3 first:pl-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <td className="pr-4.5 text-right">
                  <Icon name="chevronRight" size={16} className="ml-auto text-muted-foreground" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-px bg-border md:hidden">
        {rows.map((row) => (
          <li key={row.refNo}>
            <Link
              href={`/staff/queue/${row.refNo}`}
              className={cn("block border-l-[3px] bg-card px-3.5 py-3", SLA_ROW[row.sla])}
            >
              <span className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-mono text-[11.5px] font-medium text-primary">
                  {row.refNo}
                </span>
                <span className={cn("font-mono text-[11px] font-semibold", SLA_TEXT[row.sla])}>
                  {row.wait}
                </span>
              </span>
              <span className="block truncate text-[13px] font-semibold">
                {row.organizationName ?? row.requesterName}
              </span>
              <span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground">
                {row.maskedKey}
              </span>
              <span className="mt-2 block">
                <ReasonBadge row={row} compact />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
