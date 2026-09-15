import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { decrypt, encrypt, generateToken } from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import { resultApprovedTemplate, resultRejectedTemplate } from "@/lib/email/templates";
import { appUrl } from "@/lib/utils/app-url";
import { formatCitizenId } from "@/lib/validations/identifiers";
import type { QueueQuery, RejectRequestData } from "@/lib/validations/review";
import { resultLinkExpiresAt } from "@/lib/verification/access-token";
import { degreeLabel, displayName } from "@/lib/verification/display";
import { normalizeRefNo } from "@/lib/verification/ref-no";
import { statusForRejectReason } from "@/lib/verification/reject-reasons";
import { slaCutoff } from "@/lib/verification/sla";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";
import { getSettings } from "./settings.service";
import { maskSearchValue, toResultSnapshot } from "./verification.service";

// Phase 4 — งานพิจารณาคำขอของเจ้าหน้าที่ทะเบียน (F-REG-01 ถึง 06, 09)

export const QUEUE_PAGE_SIZE = 20;

type Staff = { id: string };

function localeOf(value: string): "th" | "en" {
  return value === "en" ? "en" : "th";
}

// เที่ยงคืนตามเวลาไทยของวันนี้ — ใช้นับ "พิจารณาวันนี้"
function startOfBangkokDay(now: Date): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
  return new Date(`${ymd}T00:00:00+07:00`);
}

function bangkokDay(isoDay: string, offsetDays = 0): Date {
  return new Date(new Date(`${isoDay}T00:00:00+07:00`).getTime() + offsetDays * 86_400_000);
}

// ------------------------------------------------------------
// F-REG-01 / F-REG-09 — คิวงาน
// ------------------------------------------------------------

export async function getQueue(query: QueueQuery, now: Date = new Date()) {
  const { slaHours } = await getSettings();
  const cutoff = slaCutoff(now, slaHours);
  const today = startOfBangkokDay(now);
  const pending: Prisma.VerificationRequestWhereInput = { status: "PENDING_REVIEW" };

  const where: Prisma.VerificationRequestWhereInput = {
    AND: [
      pending,
      query.reason ? { reviewReason: query.reason } : {},
      query.sla === "over" ? { createdAt: { lte: cutoff } } : {},
      query.org ? { organizationId: query.org } : {},
      query.from ? { createdAt: { gte: bangkokDay(query.from) } } : {},
      query.to ? { createdAt: { lt: bangkokDay(query.to, 1) } } : {},
    ],
  };

  const [
    rows,
    total,
    inQueue,
    overSla,
    decidedToday,
    createdToday,
    autoToday,
    reasons,
    organizations,
  ] = await Promise.all([
    prisma.verificationRequest.findMany({
      where,
      orderBy: { createdAt: query.sort === "newest" ? "desc" : "asc" },
      skip: (query.page - 1) * QUEUE_PAGE_SIZE,
      take: QUEUE_PAGE_SIZE,
      select: {
        refNo: true,
        createdAt: true,
        reviewReason: true,
        searchType: true,
        searchValueEnc: true,
        requester: { select: { name: true, email: true } },
        organization: { select: { nameTh: true, nameEn: true } },
      },
    }),
    prisma.verificationRequest.count({ where }),
    prisma.verificationRequest.count({ where: pending }),
    prisma.verificationRequest.count({ where: { ...pending, createdAt: { lte: cutoff } } }),
    prisma.verificationRequest.count({
      where: { decisionType: "MANUAL", decidedAt: { gte: today } },
    }),
    prisma.verificationRequest.count({ where: { createdAt: { gte: today } } }),
    prisma.verificationRequest.count({
      where: { decisionType: "AUTO", createdAt: { gte: today } },
    }),
    prisma.verificationRequest.groupBy({
      by: ["reviewReason"],
      where: pending,
      _count: { _all: true },
    }),
    prisma.organization.findMany({
      where: { requests: { some: pending } },
      select: { id: true, nameTh: true, nameEn: true },
      orderBy: { nameTh: "asc" },
    }),
  ]);

  const reasonCounts: Partial<Record<string, number>> = {};
  for (const r of reasons) if (r.reviewReason) reasonCounts[r.reviewReason] = r._count._all;

  return {
    rows: rows.map(({ searchType, searchValueEnc, ...row }) => ({
      ...row,
      maskedKey: maskSearchValue(searchType, searchValueEnc),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE)),
    slaHours,
    stats: {
      inQueue,
      overSla,
      decidedToday,
      autoRate: createdToday > 0 ? Math.round((autoToday / createdToday) * 100) : null,
    },
    reasonCounts,
    organizations,
  };
}

export type QueueRow = Awaited<ReturnType<typeof getQueue>>["rows"][number];

// ------------------------------------------------------------
// F-REG-02 — หน้าพิจารณา
// ------------------------------------------------------------

export async function getReviewDetail(refNoParam: string, staff: Staff, context: RequestContext) {
  const refNo = normalizeRefNo(refNoParam);
  if (!refNo) return null;

  const request = await prisma.verificationRequest.findUnique({
    where: { refNo },
    include: {
      requester: { select: { name: true, email: true, phone: true } },
      organization: { select: { id: true, nameTh: true, nameEn: true, status: true } },
      decidedBy: { select: { name: true } },
      result: true,
      notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!request) return null;

  const [candidates, activity] = await Promise.all([
    prisma.student.findMany({
      where:
        request.searchType === "CITIZEN_ID"
          ? { citizenIdHash: request.searchValueHash }
          : { passportNoHash: request.searchValueHash },
      orderBy: { studentCode: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "VerificationRequest", entityId: request.id },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        action: true,
        createdAt: true,
        ipAddress: true,
        metadata: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  // การเปิดหน้าพิจารณา = เข้าถึงข้อมูลส่วนบุคคล
  writeAuditLog({
    action: AuditAction.REVIEW_VIEWED,
    actorId: staff.id,
    entityType: "VerificationRequest",
    entityId: request.id,
    metadata: { refNo },
    context,
  });

  const { searchValueEnc, accessTokenEnc: _enc, accessTokenHash: _hash, ...rest } = request;
  return {
    ...rest,
    maskedKey: maskSearchValue(request.searchType, searchValueEnc),
    candidates,
    activity,
  };
}

export type ReviewDetail = NonNullable<Awaited<ReturnType<typeof getReviewDetail>>>;

// ดูเลขเต็ม — บันทึก audit ทุกครั้งพร้อมผู้ใช้และเวลา
export async function revealSearchValue(
  refNoParam: string,
  staff: Staff,
  context: RequestContext,
): Promise<string | null> {
  const refNo = normalizeRefNo(refNoParam);
  const request = refNo
    ? await prisma.verificationRequest.findUnique({
        where: { refNo },
        select: { id: true, searchType: true, searchValueEnc: true },
      })
    : null;
  // คำขอที่ถูก anonymise ตามนโยบายเก็บรักษาแล้ว ไม่มีเลขให้เปิดดู
  if (!request?.searchValueEnc) return null;

  writeAuditLog({
    action: AuditAction.PERSONAL_DATA_REVEALED,
    actorId: staff.id,
    entityType: "VerificationRequest",
    entityId: request.id,
    metadata: { refNo, field: "searchValue" },
    context,
  });
  const value = decrypt(request.searchValueEnc);
  return request.searchType === "CITIZEN_ID" ? formatCitizenId(value) : value;
}

// ------------------------------------------------------------
// F-REG-04 / F-REG-05 — ตัดสินคำขอ
// ------------------------------------------------------------

export type DecisionResult =
  { ok: true } | { ok: false; code: "notFound" | "alreadyDecided" | "studentNotFound" };

export async function approveRequest(
  input: { refNo: string; studentId: string },
  staff: Staff,
  context: RequestContext,
): Promise<DecisionResult> {
  const refNo = normalizeRefNo(input.refNo);
  if (!refNo) return { ok: false, code: "notFound" };

  const [request, student] = await Promise.all([
    prisma.verificationRequest.findUnique({
      where: { refNo },
      select: { id: true, status: true, requester: { select: { email: true, locale: true } } },
    }),
    prisma.student.findUnique({ where: { id: input.studentId } }),
  ]);
  if (!request) return { ok: false, code: "notFound" };
  if (request.status !== "PENDING_REVIEW") return { ok: false, code: "alreadyDecided" };
  if (!student) return { ok: false, code: "studentNotFound" };

  const now = new Date();
  const token = generateToken();
  const { linkExpiresDays } = await getSettings();
  // updateMany + เงื่อนไขสถานะ = เจ้าหน้าที่สองคนกดพร้อมกัน จะสำเร็จเพียงคนเดียว
  const decided = await prisma.$transaction(async (tx) => {
    const updated = await tx.verificationRequest.updateMany({
      where: { id: request.id, status: "PENDING_REVIEW" },
      data: {
        status: "APPROVED",
        decisionType: "MANUAL",
        decidedById: staff.id,
        decidedAt: now,
        matchedStudentId: student.id,
        accessTokenHash: token.tokenHash,
        accessTokenEnc: encrypt(token.token),
        expiresAt: resultLinkExpiresAt(now, linkExpiresDays),
      },
    });
    if (updated.count === 0) return false;
    await tx.verificationResult.create({
      data: { ...toResultSnapshot(student), requestId: request.id },
    });
    return true;
  });
  if (!decided) return { ok: false, code: "alreadyDecided" };

  writeAuditLog({
    action: AuditAction.VERIFICATION_APPROVED,
    actorId: staff.id,
    entityType: "VerificationRequest",
    entityId: request.id,
    metadata: { refNo, studentCode: student.studentCode },
    context,
  });

  const locale = localeOf(request.requester.locale);
  void sendMail({
    to: request.requester.email,
    ...resultApprovedTemplate({
      locale,
      refNo,
      fullName: displayName(student, locale),
      degree: degreeLabel(student, locale),
      graduationDate: student.graduationDate,
      decision: "MANUAL",
      url: appUrl(`/verify/result/${refNo}?t=${token.token}`, locale),
      expiresDays: linkExpiresDays,
    }),
  });
  return { ok: true };
}

export async function rejectRequest(
  input: RejectRequestData,
  staff: Staff,
  context: RequestContext,
): Promise<DecisionResult> {
  const refNo = normalizeRefNo(input.refNo);
  if (!refNo) return { ok: false, code: "notFound" };

  const now = new Date();
  const status = statusForRejectReason(input.reason);
  const updated = await prisma.verificationRequest.updateMany({
    where: { refNo, status: "PENDING_REVIEW" },
    data: {
      status,
      rejectReason: input.reason,
      rejectDetail: input.detail ?? null,
      decisionType: "MANUAL",
      decidedById: staff.id,
      decidedAt: now,
    },
  });

  const request = await prisma.verificationRequest.findUnique({
    where: { refNo },
    select: { id: true, requester: { select: { email: true, locale: true } } },
  });
  if (!request) return { ok: false, code: "notFound" };
  if (updated.count === 0) return { ok: false, code: "alreadyDecided" };

  writeAuditLog({
    action: AuditAction.VERIFICATION_REJECTED,
    actorId: staff.id,
    entityType: "VerificationRequest",
    entityId: request.id,
    metadata: { refNo, status, reason: input.reason },
    context,
  });

  const locale = localeOf(request.requester.locale);
  void sendMail({
    to: request.requester.email,
    ...resultRejectedTemplate({
      locale,
      refNo,
      reason: input.reason,
      detail: input.detail ?? null,
      decidedAt: now,
      url: appUrl(`/requests/${refNo}`, locale),
    }),
  });
  return { ok: true };
}

// ------------------------------------------------------------
// F-REG-06 — หมายเหตุภายใน
// ------------------------------------------------------------

export async function addInternalNote(
  input: { refNo: string; body: string },
  staff: Staff,
  context: RequestContext,
): Promise<{ ok: true } | { ok: false; code: "notFound" }> {
  const refNo = normalizeRefNo(input.refNo);
  const request = refNo
    ? await prisma.verificationRequest.findUnique({ where: { refNo }, select: { id: true } })
    : null;
  if (!request) return { ok: false, code: "notFound" };

  const note = await prisma.requestNote.create({
    data: { requestId: request.id, authorId: staff.id, body: input.body },
    select: { id: true },
  });
  // ไม่เก็บเนื้อหาโน้ตใน audit (อาจมีข้อมูลส่วนบุคคล) — อ้างอิงด้วย noteId
  writeAuditLog({
    action: AuditAction.REQUEST_NOTE_ADDED,
    actorId: staff.id,
    entityType: "VerificationRequest",
    entityId: request.id,
    metadata: { refNo, noteId: note.id },
    context,
  });
  return { ok: true };
}
