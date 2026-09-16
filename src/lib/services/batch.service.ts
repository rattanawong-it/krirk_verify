import "server-only";
import type { BatchItemStatus, Prisma } from "@/generated/prisma/client";
import type { ParsedBatchRow } from "@/lib/batch/rows";
import { decrypt, encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";
import type { BatchUploadData } from "@/lib/validations/batch";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";
import { consumeBatchQuota } from "./rate-limit.service";
import { submitRequest } from "./verification.service";

// F-BAT-03 ถึง F-BAT-07 — งานตรวจสอบแบบชุด
// แถวที่ผ่าน validate จะถูกยื่นเป็นคำขอจริงทีละแถวผ่าน verification.service (กฎ auto-approve ชุดเดียวกัน)
// โควตาหักที่ระดับชุดตอนสร้างงาน (แถวต่อวัน) แถวแต่ละแถวจึงไม่หักโควตาคำขอเดี่ยวซ้ำ

export const BATCH_PAGE_SIZE = 10;

export type BatchViewer = { id: string; organizationId: string | null };

// ผู้ใช้ในหน่วยงานเดียวกันเห็นงานของกันและกัน (ตามที่อนุมัติใน spec v1.4)
function scopeFor(viewer: BatchViewer): Prisma.BatchJobWhereInput {
  return viewer.organizationId
    ? { requester: { organizationId: viewer.organizationId } }
    : { requesterId: viewer.id };
}

export type CreateBatchResult =
  | { ok: true; batchId: string; validCount: number; invalidCount: number }
  | { ok: false; code: "noValidRows" }
  | { ok: false; code: "quotaExceeded"; retryAfterSec: number };

export async function createBatchJob(input: {
  actorId: string;
  fileName: string;
  data: BatchUploadData;
  rows: ParsedBatchRow[];
  context: RequestContext;
}): Promise<CreateBatchResult> {
  const valid = input.rows.filter((row) => row.ok);
  if (valid.length === 0) return { ok: false, code: "noValidRows" };

  // หักโควตาตามจำนวนแถวที่จะยื่นจริง — เกินโควตาไม่หักแต้มเลย ผู้ขอแก้ไฟล์แล้วอัปโหลดใหม่ได้
  const quota = await consumeBatchQuota(input.actorId, valid.length);
  if (!quota.ok) {
    writeAuditLog({
      action: AuditAction.BATCH_RATE_LIMITED,
      actorId: input.actorId,
      metadata: { rows: valid.length, retryAfterSec: quota.retryAfterSec },
      context: input.context,
    });
    return { ok: false, code: "quotaExceeded", retryAfterSec: quota.retryAfterSec };
  }

  const now = new Date();
  const job = await prisma.batchJob.create({
    data: {
      requesterId: input.actorId,
      fileName: input.fileName.slice(0, 200),
      purpose: input.data.purpose,
      totalRows: input.rows.length,
      validRows: valid.length,
      invalidRows: input.rows.length - valid.length,
      consentAt: now,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent?.slice(0, 500) ?? null,
      items: {
        create: input.rows.map((row) =>
          row.ok
            ? {
                rowNo: row.rowNo,
                searchType: row.searchType,
                searchValueEnc: encrypt(row.searchValue),
                searchValueMasked: row.masked,
                resultStatus: "PENDING" as const,
              }
            : {
                rowNo: row.rowNo,
                searchValueMasked: row.raw || "—",
                resultStatus: "INVALID" as const,
                errorCode: row.errorCode,
              },
        ),
      },
    },
    select: { id: true },
  });

  writeAuditLog({
    action: AuditAction.BATCH_UPLOADED,
    actorId: input.actorId,
    entityType: "BatchJob",
    entityId: job.id,
    // ไม่บันทึกชื่อไฟล์เต็มหรือคีย์ค้นหาลง audit — เก็บเฉพาะจำนวน
    metadata: {
      totalRows: input.rows.length,
      validRows: valid.length,
      purpose: input.data.purpose,
    },
    context: input.context,
  });

  return {
    ok: true,
    batchId: job.id,
    validCount: valid.length,
    invalidCount: input.rows.length - valid.length,
  };
}

export type RunnableBatch = { id: string; requesterId: string };

// DRAFT → PROCESSING แบบ optimistic — กดยืนยันซ้ำหรือสองแท็บพร้อมกัน จะมีเพียงครั้งเดียวที่ได้ทำงาน
export async function startBatchProcessing(
  batchId: string,
  viewer: BatchViewer,
): Promise<RunnableBatch | null> {
  const job = await prisma.batchJob.findFirst({
    where: { id: batchId, status: "DRAFT", ...scopeFor(viewer) },
    select: { id: true, requesterId: true },
  });
  if (!job) return null;

  const claimed = await prisma.batchJob.updateMany({
    where: { id: job.id, status: "DRAFT" },
    data: { status: "PROCESSING", startedAt: new Date() },
  });
  return claimed.count === 1 ? job : null;
}

function statusOf(result: Awaited<ReturnType<typeof submitRequest>>): {
  status: BatchItemStatus;
  refNo: string | null;
  errorCode: string | null;
} {
  if (result.ok) {
    return {
      status: result.status === "APPROVED" ? "APPROVED" : "PENDING_REVIEW",
      refNo: result.refNo,
      errorCode: null,
    };
  }
  return { status: "ERROR", refNo: null, errorCode: result.code };
}

// F-BAT-04 — ประมวลผลเบื้องหลัง (เรียกผ่าน after() ของ route) พร้อมอัปเดต processedRows ให้แถบความคืบหน้า
export async function executeBatch(job: RunnableBatch, context: RequestContext): Promise<void> {
  try {
    const items = await prisma.batchItem.findMany({
      where: { batchJobId: job.id, resultStatus: "PENDING" },
      orderBy: { rowNo: "asc" },
      select: { id: true, searchType: true, searchValueEnc: true },
    });
    const purpose = (
      await prisma.batchJob.findUniqueOrThrow({
        where: { id: job.id },
        select: { purpose: true },
      })
    ).purpose;

    for (const item of items) {
      let outcome: { status: BatchItemStatus; refNo: string | null; errorCode: string | null };
      try {
        if (!item.searchType || !item.searchValueEnc) {
          outcome = { status: "ERROR", refNo: null, errorCode: "missingValue" };
        } else {
          const result = await submitRequest(
            job.requesterId,
            {
              kind: "search",
              source: "batch",
              data: {
                searchType: item.searchType,
                searchValue: decrypt(item.searchValueEnc),
                purpose,
                // อ้างอิงและหมายเหตุเป็นของคำขอเดี่ยว — ไฟล์แบบชุดมีเพียงคีย์ค้นหาต่อแถว
                requesterReference: undefined,
                note: undefined,
                consent: true,
              },
            },
            context,
          );
          outcome = statusOf(result);
        }
      } catch (error) {
        console.error("[batch] ยื่นคำขอจากแถวไม่สำเร็จ", job.id, item.id, error);
        outcome = { status: "ERROR", refNo: null, errorCode: "internal" };
      }

      // อัปเดตทีละแถวเพื่อให้หน้าเว็บเห็นความคืบหน้าระหว่างประมวลผล
      await prisma.$transaction([
        prisma.batchItem.update({
          where: { id: item.id },
          data: {
            resultStatus: outcome.status,
            refNo: outcome.refNo,
            errorCode: outcome.errorCode,
            ...(outcome.refNo ? { request: { connect: { refNo: outcome.refNo } } } : {}),
          },
        }),
        prisma.batchJob.update({
          where: { id: job.id },
          data: { processedRows: { increment: 1 } },
        }),
      ]);
    }

    const finished = await prisma.batchJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", finishedAt: new Date() },
      select: { totalRows: true, validRows: true, invalidRows: true },
    });
    writeAuditLog({
      action: AuditAction.BATCH_PROCESSED,
      actorId: job.requesterId,
      entityType: "BatchJob",
      entityId: job.id,
      metadata: { ...finished },
      context,
    });
  } catch (error) {
    console.error("[batch] ประมวลผลชุดไม่สำเร็จ", job.id, error);
    await prisma.batchJob
      .update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        },
      })
      .catch(() => undefined);
  }
}

const itemSelect = {
  id: true,
  rowNo: true,
  searchType: true,
  searchValueMasked: true,
  resultStatus: true,
  errorCode: true,
  refNo: true,
  request: { select: { status: true } },
} satisfies Prisma.BatchItemSelect;

export type BatchItemRow = Prisma.BatchItemGetPayload<{ select: typeof itemSelect }>;

// สถานะที่แสดงผล = สถานะล่าสุดของคำขอ (เจ้าหน้าที่อาจอนุมัติ/ปฏิเสธภายหลัง) ไม่ใช่สถานะตอนสร้าง
export function displayStatus(item: BatchItemRow): BatchItemStatus {
  if (item.resultStatus === "INVALID" || item.resultStatus === "ERROR") return item.resultStatus;
  switch (item.request?.status) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "PENDING_REVIEW":
      return "PENDING_REVIEW";
    default:
      return item.resultStatus;
  }
}

export type BatchSummary = Record<"approved" | "pending" | "notFound" | "invalid", number>;

export function summarize(items: BatchItemRow[]): BatchSummary {
  const summary: BatchSummary = { approved: 0, pending: 0, notFound: 0, invalid: 0 };
  for (const item of items) {
    const status = displayStatus(item);
    if (status === "APPROVED") summary.approved++;
    else if (status === "PENDING_REVIEW") summary.pending++;
    else if (status === "NOT_FOUND" || status === "REJECTED") summary.notFound++;
    else summary.invalid++;
  }
  return summary;
}

export async function getBatchJob(batchId: string, viewer: BatchViewer) {
  const job = await prisma.batchJob.findFirst({
    where: { id: batchId, ...scopeFor(viewer) },
    select: {
      id: true,
      fileName: true,
      purpose: true,
      status: true,
      totalRows: true,
      processedRows: true,
      validRows: true,
      invalidRows: true,
      errorMessage: true,
      createdAt: true,
      finishedAt: true,
      requester: { select: { name: true } },
      items: { orderBy: { rowNo: "asc" }, select: itemSelect },
    },
  });
  return job ? { ...job, summary: summarize(job.items) } : null;
}

export async function listBatchJobs(viewer: BatchViewer, page: number) {
  const where = scopeFor(viewer);
  const [rows, total] = await Promise.all([
    prisma.batchJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * BATCH_PAGE_SIZE,
      take: BATCH_PAGE_SIZE,
      select: {
        id: true,
        fileName: true,
        status: true,
        totalRows: true,
        processedRows: true,
        validRows: true,
        invalidRows: true,
        createdAt: true,
      },
    }),
    prisma.batchJob.count({ where }),
  ]);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / BATCH_PAGE_SIZE)) };
}

export function recordBatchExport(batchId: string, actorId: string, context: RequestContext): void {
  writeAuditLog({
    action: AuditAction.BATCH_EXPORTED,
    actorId,
    entityType: "BatchJob",
    entityId: batchId,
    context,
  });
}
