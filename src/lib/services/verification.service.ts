import "server-only";
import type { Prisma, RequestStatus, Student } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/routing";
import type { AppRole } from "@/lib/auth/rbac";
import {
  decrypt,
  encrypt,
  generateToken,
  hashIdentifier,
  maskCitizenId,
  maskPassportNo,
} from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";
import { getRegistryClient } from "@/lib/integrations/registry";
import { sendTemplateMail } from "@/lib/email/mailer";
import { appUrl } from "@/lib/utils/app-url";
import {
  isValidPassportNo,
  isValidThaiCitizenId,
  stripIdentifier,
} from "@/lib/validations/identifiers";
import type { SubmitOwnRequestData, SubmitRequestData } from "@/lib/validations/verification";
import {
  isLinkExpired,
  matchesAccessToken,
  resultLinkExpiresAt,
} from "@/lib/verification/access-token";
import { decideVerification } from "@/lib/verification/auto-approve";
import { degreeLabel, displayName } from "@/lib/verification/display";
import { buddhistYear, formatRefNo, normalizeRefNo } from "@/lib/verification/ref-no";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";
import { notifyQueueEntry } from "./notification.service";
import {
  consumeVerificationQuota,
  isPermalinkBlocked,
  recordPermalinkFailure,
} from "./rate-limit.service";
import { getSettings } from "./settings.service";

// หัวใจของระบบ (spec ข้อ 5.4) — Server Action เรียกผ่านไฟล์นี้เท่านั้น

export const REQUEST_PAGE_SIZE = 20;

type SearchType = "CITIZEN_ID" | "PASSPORT";

function localeOf(value: string): AppLocale {
  return value === "en" ? "en" : "th";
}

export function maskSearchValue(searchType: SearchType, searchValueEnc: string): string {
  // คำขอที่ถูก anonymise ตามนโยบายเก็บรักษา (F-AUD-08) ไม่มีคีย์ค้นหาเหลืออยู่
  if (!searchValueEnc) return "—";
  const value = decrypt(searchValueEnc);
  return searchType === "CITIZEN_ID" ? maskCitizenId(value) : maskPassportNo(value);
}

// F-VER-06 — คัดลอกทุกฟิลด์ที่แสดงผลตาม R-07 ออกจากตาราง Student ณ เวลาอนุมัติ (ใช้ซ้ำใน Phase 4)
export function toResultSnapshot(
  student: Student,
): Prisma.VerificationResultCreateWithoutRequestInput {
  return {
    studentId: student.id,
    studentCode: student.studentCode,
    prefixTh: student.prefixTh,
    firstNameTh: student.firstNameTh,
    lastNameTh: student.lastNameTh,
    prefixEn: student.prefixEn,
    firstNameEn: student.firstNameEn,
    lastNameEn: student.lastNameEn,
    educationLevel: student.educationLevel,
    degreeNameTh: student.degreeNameTh,
    degreeNameEn: student.degreeNameEn,
    programTh: student.programTh,
    programEn: student.programEn,
    majorTh: student.majorTh,
    majorEn: student.majorEn,
    facultyTh: student.facultyTh,
    facultyEn: student.facultyEn,
    gpa: student.gpa,
    honors: student.honors,
    status: student.status,
    graduationDate: student.graduationDate,
    councilApprovalDate: student.councilApprovalDate,
    graduationTerm: student.graduationTerm,
    sourceUpdatedAt: student.sourceUpdatedAt,
  };
}

// จองเลขในคำสั่งเดียว — แถวของปีนั้นถูกล็อกจนธุรกรรมจบ จึงไม่มีเลขซ้ำ และถ้าธุรกรรมล้มเลขไม่ถูกใช้
async function nextRefNo(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const year = buddhistYear(now);
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO ref_no_counters ("year", "lastValue") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastValue" = ref_no_counters."lastValue" + 1
    RETURNING "lastValue"`;
  return formatRefNo(year, Number(rows[0]!.lastValue));
}

export type SubmitInput = (
  { kind: "search"; data: SubmitRequestData } | { kind: "own"; data: SubmitOwnRequestData }
) & {
  // F-BAT-07 — แถวที่มาจากไฟล์แบบชุดหักโควตา "แถวต่อวัน" ไปแล้วตอนสร้างงาน
  // จึงไม่หักโควตาคำขอเดี่ยวรายชั่วโมงซ้ำ และไม่ส่งอีเมลรายแถวให้ผู้ขอ
  source?: "single" | "batch";
};

export type SubmitResult =
  | { ok: true; refNo: string; status: "APPROVED" | "PENDING_REVIEW" }
  | { ok: false; code: "rateLimited"; retryAfterSec: number }
  | { ok: false; code: "noLinkedRecord" | "forbidden" };

export async function submitRequest(
  userId: string,
  input: SubmitInput,
  context: RequestContext,
): Promise<SubmitResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      locale: true,
      organizationId: true,
      student: { select: { citizenIdEnc: true, passportNoEnc: true } },
    },
  });
  const allowed =
    (user?.role === "EXTERNAL" && input.kind === "search") ||
    (user?.role === "ALUMNI" && input.kind === "own");
  if (!user || !allowed) return { ok: false, code: "forbidden" };

  // 1. คีย์ค้นหา — ศิษย์เก่าใช้ระเบียนที่ผูกไว้ตอนลงทะเบียนเท่านั้น
  let searchType: SearchType;
  let searchValue: string;
  if (input.kind === "search") {
    searchType = input.data.searchType;
    searchValue = input.data.searchValue;
  } else if (user.student?.citizenIdEnc) {
    searchType = "CITIZEN_ID";
    searchValue = decrypt(user.student.citizenIdEnc);
  } else if (user.student?.passportNoEnc) {
    searchType = "PASSPORT";
    searchValue = decrypt(user.student.passportNoEnc);
  } else {
    return { ok: false, code: "noLinkedRecord" };
  }

  // 2. rate limit ต่อผู้ใช้และต่อ IP (แถวแบบชุดหักโควตารายวันไปแล้ว — F-BAT-07)
  const quota =
    input.source === "batch"
      ? ({ ok: true, remaining: 0 } as const)
      : await consumeVerificationQuota(user.id, context.ipAddress);
  if (!quota.ok) {
    writeAuditLog({
      action: AuditAction.VERIFICATION_RATE_LIMITED,
      actorId: user.id,
      metadata: { retryAfterSec: quota.retryAfterSec },
      context,
    });
    return { ok: false, code: "rateLimited", retryAfterSec: quota.retryAfterSec };
  }

  // 3. ค้นด้วย HMAC ของคีย์ (exact match)
  const searchValueHash = hashIdentifier(searchValue);
  const candidates = await prisma.student.findMany({
    where:
      searchType === "CITIZEN_ID"
        ? { citizenIdHash: searchValueHash }
        : { passportNoHash: searchValueHash },
    orderBy: { studentCode: "asc" },
  });

  // 4–5. ตัดสินตามกฎข้อ 4.2 แล้วสร้างคำขอ (+ snapshot เมื่ออนุมัติ) ในธุรกรรมเดียว
  const settings = await getSettings();
  const decision = decideVerification(candidates, {
    autoApproveEnabled: settings.autoApproveEnabled,
    requireCouncilApproval: getRegistryClient().capabilities.councilApprovalDate,
  });
  const now = new Date();
  const approvedStudent =
    decision.outcome === "AUTO_APPROVE"
      ? candidates.find((c) => c.id === decision.studentId)!
      : null;
  const token = approvedStudent ? generateToken() : null;

  const request = await prisma.$transaction(async (tx) => {
    const refNo = await nextRefNo(tx, now);
    return tx.verificationRequest.create({
      data: {
        refNo,
        requesterId: user.id,
        organizationId: user.organizationId,
        searchType,
        searchValueHash,
        searchValueEnc: encrypt(searchValue),
        purpose: input.data.purpose,
        requesterReference: input.data.requesterReference,
        note: input.data.note,
        consentAt: now,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent?.slice(0, 500) ?? null,
        matchedStudentId: decision.studentId,
        ...(approvedStudent && token
          ? {
              status: "APPROVED",
              decisionType: "AUTO",
              decidedAt: now,
              accessTokenHash: token.tokenHash,
              accessTokenEnc: encrypt(token.token),
              expiresAt: resultLinkExpiresAt(now, settings.linkExpiresDays),
              result: { create: toResultSnapshot(approvedStudent) },
            }
          : {
              status: "PENDING_REVIEW",
              reviewReason: decision.outcome === "REVIEW" ? decision.reason : null,
            }),
      },
      select: { id: true, refNo: true },
    });
  });

  // 6. audit + อีเมล (ไม่บันทึกเลขบัตรลง log)
  writeAuditLog({
    action: AuditAction.VERIFICATION_SUBMITTED,
    actorId: user.id,
    entityType: "VerificationRequest",
    entityId: request.id,
    metadata: {
      refNo: request.refNo,
      searchType,
      outcome: decision.outcome,
      reviewReason: decision.outcome === "REVIEW" ? decision.reason : null,
    },
    context,
  });

  const locale = localeOf(user.locale);
  // F-BAT-07 — ไฟล์แบบชุด 500 แถวต้องไม่กลายเป็นอีเมล 500 ฉบับ · ผู้ขอดูผลรวมที่หน้าผลลัพธ์ของชุด
  const emailRequester = input.source !== "batch";
  if (approvedStudent && token) {
    if (emailRequester)
      void sendTemplateMail({
        template: "resultApproved",
        to: user.email,
        userId: user.id,
        entityType: "VerificationRequest",
        entityId: request.id,
        payload: {
          locale,
          refNo: request.refNo,
          fullName: displayName(approvedStudent, locale),
          degree: degreeLabel(approvedStudent, locale),
          graduationDate: approvedStudent.graduationDate,
          graduationTerm: approvedStudent.graduationTerm,
          decision: "AUTO",
          url: appUrl(`/verify/result/${request.refNo}?t=${token.token}`, locale),
          expiresDays: settings.linkExpiresDays,
        },
      });
  } else {
    if (emailRequester)
      void sendTemplateMail({
        template: "requestReceived",
        to: user.email,
        userId: user.id,
        entityType: "VerificationRequest",
        entityId: request.id,
        payload: {
          locale,
          refNo: request.refNo,
          searchKey:
            searchType === "CITIZEN_ID" ? maskCitizenId(searchValue) : maskPassportNo(searchValue),
          purpose: input.data.purpose,
          submittedAt: now,
          url: appUrl(`/requests/${request.refNo}`, locale),
        },
      });
    // F-NOT-03 / F-NOT-05 — เจ้าหน้าที่เห็นในกระดิ่งทันที ส่วนอีเมลเป็นสรุปรายวันเพื่อไม่ให้อีเมลท่วม
    void notifyQueueEntry(request.refNo);
  }

  return {
    ok: true,
    refNo: request.refNo,
    status: approvedStudent ? "APPROVED" : "PENDING_REVIEW",
  };
}

// ------------------------------------------------------------
// การมองเห็นคำขอฝั่งผู้ขอ (F-VER-09)
// ------------------------------------------------------------

type Viewer = { id: string; role: AppRole; organizationId: string | null };

export async function loadViewer(userId: string): Promise<Viewer | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, organizationId: true },
  });
}

// หน่วยงานภายนอกเห็นคำขอของทุกคนในหน่วยงานเดียวกัน · ศิษย์เก่าเห็นเฉพาะของตนเอง
export function visibleTo(viewer: Viewer): Prisma.VerificationRequestWhereInput {
  return viewer.role === "EXTERNAL" && viewer.organizationId
    ? { organizationId: viewer.organizationId }
    : { requesterId: viewer.id };
}

function searchFilter(q: string): Prisma.VerificationRequestWhereInput {
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 3);
  const nameField = (token: string) => ({ contains: token, mode: "insensitive" as const });
  const conditions: Prisma.VerificationRequestWhereInput[] = [
    { refNo: { contains: q.toUpperCase() } },
    { requesterReference: { contains: q, mode: "insensitive" } },
    {
      result: {
        is: {
          AND: tokens.map((token) => ({
            OR: [
              { firstNameTh: nameField(token) },
              { lastNameTh: nameField(token) },
              { firstNameEn: nameField(token) },
              { lastNameEn: nameField(token) },
            ],
          })),
        },
      },
    },
  ];
  const key = stripIdentifier(q);
  if (isValidThaiCitizenId(key) || isValidPassportNo(key)) {
    conditions.push({ searchValueHash: hashIdentifier(key) });
  }
  return { OR: conditions };
}

export type RequestListFilter = {
  status?: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NOT_FOUND";
  q?: string;
  page: number;
};

export async function listRequests(userId: string, filter: RequestListFilter) {
  const viewer = await loadViewer(userId);
  if (!viewer) return null;

  const scope = visibleTo(viewer);
  const where: Prisma.VerificationRequestWhereInput = {
    AND: [
      scope,
      filter.status ? { status: filter.status } : {},
      filter.q ? searchFilter(filter.q) : {},
    ],
  };

  const [rows, total, grouped] = await Promise.all([
    prisma.verificationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * REQUEST_PAGE_SIZE,
      take: REQUEST_PAGE_SIZE,
      select: {
        refNo: true,
        status: true,
        searchType: true,
        searchValueEnc: true,
        purpose: true,
        createdAt: true,
        result: {
          select: {
            prefixTh: true,
            firstNameTh: true,
            lastNameTh: true,
            prefixEn: true,
            firstNameEn: true,
            lastNameEn: true,
            degreeNameTh: true,
            degreeNameEn: true,
            majorTh: true,
            majorEn: true,
          },
        },
      },
    }),
    prisma.verificationRequest.count({ where }),
    prisma.verificationRequest.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
  ]);

  const counts: Partial<Record<RequestStatus, number>> = {};
  for (const g of grouped) counts[g.status] = g._count._all;

  return {
    scope: viewer.role === "EXTERNAL" ? ("organization" as const) : ("own" as const),
    rows: rows.map(({ searchType, searchValueEnc, ...row }) => ({
      ...row,
      maskedKey: maskSearchValue(searchType, searchValueEnc),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / REQUEST_PAGE_SIZE)),
    counts,
  };
}

export type RequestListRow = NonNullable<Awaited<ReturnType<typeof listRequests>>>["rows"][number];

// ไม่ส่ง reviewReason ออกไปฝั่งผู้ขอ — ผู้ขอเห็นเพียง "รอพิจารณา" (F-VER-11)
export async function getRequestDetail(
  userId: string,
  refNoParam: string,
  context: RequestContext,
) {
  const refNo = normalizeRefNo(refNoParam);
  const viewer = refNo ? await loadViewer(userId) : null;
  if (!refNo || !viewer) return null;

  const request = await prisma.verificationRequest.findFirst({
    where: { AND: [{ refNo }, visibleTo(viewer)] },
    select: {
      id: true,
      refNo: true,
      status: true,
      searchType: true,
      searchValueEnc: true,
      purpose: true,
      requesterReference: true,
      decisionType: true,
      decidedAt: true,
      rejectReason: true,
      rejectDetail: true,
      accessTokenEnc: true,
      expiresAt: true,
      createdAt: true,
      anonymizedAt: true,
      requester: { select: { name: true } },
      decidedBy: { select: { name: true } },
      result: true,
    },
  });
  if (!request) return null;

  const approved = request.status === "APPROVED" && request.result !== null;
  const decidedNegative = request.status === "REJECTED" || request.status === "NOT_FOUND";
  const linkActive = approved && !!request.accessTokenEnc && !isLinkExpired(request.expiresAt);
  if (approved) {
    writeAuditLog({
      action: AuditAction.VERIFICATION_RESULT_VIEWED,
      actorId: viewer.id,
      entityType: "VerificationRequest",
      entityId: request.id,
      metadata: { refNo: request.refNo, via: "portal" },
      context,
    });
  }

  const { accessTokenEnc, searchValueEnc, searchType, ...rest } = request;
  return {
    ...rest,
    searchType,
    maskedKey: maskSearchValue(searchType, searchValueEnc),
    // เหตุผลเปิดเผยให้ผู้ขอหลังเจ้าหน้าที่ตัดสินแล้วเท่านั้น (F-VER-11)
    rejectReason: decidedNegative ? request.rejectReason : null,
    rejectDetail: decidedNegative ? request.rejectDetail : null,
    permalinkPath:
      linkActive && accessTokenEnc
        ? `/verify/result/${request.refNo}?t=${encodeURIComponent(decrypt(accessTokenEnc))}`
        : null,
  };
}

export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequestDetail>>>;

// ระเบียนที่ศิษย์เก่าผูกไว้ — แสดงบนฟอร์มแบบ mask (ศิษย์เก่าตรวจได้เฉพาะวุฒิของตนเอง)
export async function getOwnRecordSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { student: { select: { studentCode: true, citizenIdEnc: true, passportNoEnc: true } } },
  });
  const student = user?.student;
  if (!student) return null;
  if (student.citizenIdEnc) {
    return {
      studentCode: student.studentCode,
      searchType: "CITIZEN_ID" as const,
      maskedKey: maskSearchValue("CITIZEN_ID", student.citizenIdEnc),
    };
  }
  if (student.passportNoEnc) {
    return {
      studentCode: student.studentCode,
      searchType: "PASSPORT" as const,
      maskedKey: maskSearchValue("PASSPORT", student.passportNoEnc),
    };
  }
  return null;
}

// ------------------------------------------------------------
// Permalink สาธารณะ (F-VER-08)
// ------------------------------------------------------------

export type PublicResultOutcome =
  | {
      ok: true;
      refNo: string;
      decisionType: "AUTO" | "MANUAL" | null;
      verifiedAt: Date;
      expiresAt: Date;
      result: NonNullable<RequestDetail["result"]>;
    }
  | { ok: false; code: "invalid" | "expired" | "blocked" };

export async function getPublicResult(
  refNoParam: string,
  token: string | null,
  context: RequestContext,
): Promise<PublicResultOutcome> {
  if (await isPermalinkBlocked(context.ipAddress)) return { ok: false, code: "blocked" };

  const refNo = normalizeRefNo(refNoParam);
  const request = refNo
    ? await prisma.verificationRequest.findUnique({
        where: { refNo },
        select: {
          id: true,
          refNo: true,
          status: true,
          decisionType: true,
          decidedAt: true,
          accessTokenHash: true,
          expiresAt: true,
          result: true,
        },
      })
    : null;

  const deny = (code: "invalid" | "expired") => {
    writeAuditLog({
      action: AuditAction.PERMALINK_DENIED,
      entityType: request ? "VerificationRequest" : undefined,
      entityId: request?.id,
      metadata: { refNo: refNo ?? refNoParam.slice(0, 40), reason: code },
      context,
    });
    return { ok: false, code } as const;
  };

  // ไม่แยกว่า "ไม่มีเลขนี้" หรือ "รหัสผิด" เพื่อไม่ให้ใช้หน้านี้ตรวจว่ามีเลขอ้างอิงอยู่จริง
  if (
    !request ||
    request.status !== "APPROVED" ||
    !request.result ||
    !matchesAccessToken(request.accessTokenHash, token)
  ) {
    await recordPermalinkFailure(context.ipAddress);
    return deny("invalid");
  }
  if (isLinkExpired(request.expiresAt)) return deny("expired");

  writeAuditLog({
    action: AuditAction.VERIFICATION_RESULT_VIEWED,
    entityType: "VerificationRequest",
    entityId: request.id,
    metadata: { refNo: request.refNo, via: "permalink" },
    context,
  });

  return {
    ok: true,
    refNo: request.refNo,
    decisionType: request.decisionType,
    verifiedAt: request.decidedAt ?? request.result.createdAt,
    expiresAt: request.expiresAt!,
    result: request.result,
  };
}
