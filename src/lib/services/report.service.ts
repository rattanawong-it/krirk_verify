import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import { monthlyReportTemplate } from "@/lib/email/report-templates";
import {
  type DashboardRange,
  type Period,
  bangkokDayKey,
  dashboardPeriod,
  fillSeries,
  percentChange,
  previousMonth,
  reportPeriod,
  share,
} from "@/lib/reports/range";
import { appUrl } from "@/lib/utils/app-url";
import type { ReportQuery } from "@/lib/validations/report";
import { slaCutoff } from "@/lib/verification/sla";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";
import { MONTHLY_REPORT_LAST_SENT_KEY, getSettings } from "./settings.service";
import { loadViewer, maskSearchValue, visibleTo } from "./verification.service";

// Phase 6 — Dashboard & Reports (F-RPT-01 ถึง 08)
// สถิติทั้งหมดนับจากตาราง verification_requests ซึ่งยังคงอยู่หลัง anonymise (F-AUD-08)
// ส่วนคณะ/ระดับการศึกษานับจาก snapshot ผล จึงไม่รวมคำขอที่พ้นระยะเก็บรักษาแล้ว

type Range = { from: Date; to: Date };

export const MIX_STATUSES = ["APPROVED", "PENDING_REVIEW", "NOT_FOUND", "REJECTED"] as const;
type MixStatus = (typeof MIX_STATUSES)[number];

export const TREND_KEYS = ["approved", "pending", "negative"] as const;
type TrendRow = { bucket: string } & Record<(typeof TREND_KEYS)[number], number>;

function createdIn(range: Range): Prisma.VerificationRequestWhereInput {
  return { createdAt: { gte: range.from, lt: range.to } };
}

// เวลาพิจารณาเฉลี่ยของคำขอที่เจ้าหน้าที่ตัดสินในช่วงนี้ (ไม่รวมอนุมัติอัตโนมัติ)
// คอลัมน์เป็น timestamp(3) แบบไม่มี time zone ที่เก็บเวลา UTC → แปลงพารามิเตอร์ให้ตรงกันก่อนเทียบ
async function avgReviewSeconds(range: Range): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ seconds: number | null }[]>`
    SELECT AVG(EXTRACT(EPOCH FROM ("decidedAt" - "createdAt")))::float8 AS seconds
    FROM verification_requests
    WHERE "decisionType" = 'MANUAL'
      AND "decidedAt" >= (${range.from}::timestamptz AT TIME ZONE 'UTC')
      AND "decidedAt" < (${range.to}::timestamptz AT TIME ZONE 'UTC')`;
  const seconds = rows[0]?.seconds;
  return seconds === null || seconds === undefined ? null : Number(seconds);
}

export async function summarize(range: Range) {
  const where = createdIn(range);
  const [groups, auto, seconds] = await Promise.all([
    prisma.verificationRequest.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.verificationRequest.count({ where: { ...where, decisionType: "AUTO" } }),
    avgReviewSeconds(range),
  ]);

  const byStatus: Record<MixStatus, number> = {
    APPROVED: 0,
    PENDING_REVIEW: 0,
    NOT_FOUND: 0,
    REJECTED: 0,
  };
  let total = 0;
  for (const group of groups) {
    total += group._count._all;
    if ((MIX_STATUSES as readonly string[]).includes(group.status)) {
      byStatus[group.status as MixStatus] += group._count._all;
    }
  }
  return {
    total,
    byStatus,
    autoRate: total > 0 ? share(auto, total) : null,
    avgReviewHours: seconds === null ? null : Math.round(seconds / 360) / 10,
  };
}

export type ReportSummary = Awaited<ReturnType<typeof summarize>>;

export async function topOrganizations(range: Range, limit: number) {
  const groups = await prisma.verificationRequest.groupBy({
    by: ["organizationId"],
    where: { ...createdIn(range), organizationId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { organizationId: "desc" } },
    take: limit,
  });
  const ids = groups.flatMap((g) => (g.organizationId ? [g.organizationId] : []));
  const organizations = await prisma.organization.findMany({
    where: { id: { in: ids } },
    select: { id: true, nameTh: true, nameEn: true },
  });
  const byId = new Map(organizations.map((org) => [org.id, org]));
  return groups.flatMap((group) => {
    const org = group.organizationId ? byId.get(group.organizationId) : undefined;
    return org ? [{ ...org, count: group._count._all }] : [];
  });
}

async function resultBreakdown(range: Range) {
  const where: Prisma.VerificationResultWhereInput = { request: createdIn(range) };
  const [faculties, levels] = await Promise.all([
    prisma.verificationResult.groupBy({
      by: ["facultyTh", "facultyEn"],
      where,
      _count: { _all: true },
      orderBy: { _count: { facultyTh: "desc" } },
      take: 8,
    }),
    prisma.verificationResult.groupBy({
      by: ["educationLevel"],
      where,
      _count: { _all: true },
      orderBy: { _count: { educationLevel: "desc" } },
    }),
  ]);
  return {
    faculties: faculties.map((f) => ({
      nameTh: f.facultyTh,
      nameEn: f.facultyEn,
      count: f._count._all,
    })),
    levels: levels.map((l) => ({ level: l.educationLevel, count: l._count._all })),
  };
}

// แนวโน้มแยกตามสถานะปัจจุบันของคำขอ รวมกลุ่มตามวัน/เดือนตามเวลาไทย
async function trend(period: Period): Promise<TrendRow[]> {
  const from = period.from;
  const to = period.to;
  if (period.granularity === "day") {
    return prisma.$queryRaw<TrendRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS bucket,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::int AS pending,
        COUNT(*) FILTER (WHERE status IN ('NOT_FOUND', 'REJECTED'))::int AS negative
      FROM verification_requests
      WHERE "createdAt" >= (${from}::timestamptz AT TIME ZONE 'UTC')
        AND "createdAt" < (${to}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY 1`;
  }
  return prisma.$queryRaw<TrendRow[]>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') AS bucket,
      COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
      COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::int AS pending,
      COUNT(*) FILTER (WHERE status IN ('NOT_FOUND', 'REJECTED'))::int AS negative
    FROM verification_requests
    WHERE "createdAt" >= (${from}::timestamptz AT TIME ZONE 'UTC')
      AND "createdAt" < (${to}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1`;
}

// ------------------------------------------------------------
// F-RPT-02 ถึง 05 — แดชบอร์ดสถิติของเจ้าหน้าที่
// ------------------------------------------------------------

export async function getStaffDashboard(range: DashboardRange, now: Date = new Date()) {
  const period = dashboardPeriod(range, now);
  const current = { from: period.from, to: period.to };
  const { slaHours } = await getSettings();

  const [summary, previous, inQueue, overSla, trendRows, organizations, breakdown] =
    await Promise.all([
      summarize(current),
      summarize({ from: period.previousFrom, to: period.from }),
      prisma.verificationRequest.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.verificationRequest.count({
        where: { status: "PENDING_REVIEW", createdAt: { lte: slaCutoff(now, slaHours) } },
      }),
      trend(period),
      topOrganizations(current, 10),
      resultBreakdown(current),
    ]);

  return {
    period,
    slaHours,
    summary,
    kpis: {
      totalChange: percentChange(summary.total, previous.total),
      // อัตราอนุมัติอัตโนมัติเทียบเป็นจุดเปอร์เซ็นต์ ไม่ใช่ % เปลี่ยนแปลง
      autoRateDelta:
        summary.autoRate !== null && previous.autoRate !== null
          ? summary.autoRate - previous.autoRate
          : null,
      inQueue,
      overSla,
      avgReviewChange:
        summary.avgReviewHours !== null && previous.avgReviewHours
          ? percentChange(summary.avgReviewHours, previous.avgReviewHours)
          : null,
    },
    trend: fillSeries(
      period.buckets,
      trendRows.map((row) => ({
        bucket: row.bucket,
        approved: Number(row.approved),
        pending: Number(row.pending),
        negative: Number(row.negative),
      })),
      TREND_KEYS,
    ),
    topOrganizations: organizations,
    ...breakdown,
  };
}

export type StaffDashboard = Awaited<ReturnType<typeof getStaffDashboard>>;

// ------------------------------------------------------------
// F-RPT-06 / 07 — หน้ารายงาน + export
// ------------------------------------------------------------

export const REPORT_PAGE_SIZE = 25;
export const REPORT_EXPORT_LIMIT = 100_000;
const EXPORT_BATCH = 1000;

// ไม่ดึงชื่อ/เลขบัตร/รหัสนักศึกษา — รายงานใช้เพื่อสถิติการให้บริการเท่านั้น
const REPORT_SELECT = {
  id: true,
  refNo: true,
  createdAt: true,
  status: true,
  purpose: true,
  searchType: true,
  decisionType: true,
  decidedAt: true,
  reviewReason: true,
  anonymizedAt: true,
  organization: { select: { nameTh: true, nameEn: true } },
  result: {
    select: {
      facultyTh: true,
      facultyEn: true,
      educationLevel: true,
      degreeNameTh: true,
      degreeNameEn: true,
    },
  },
} satisfies Prisma.VerificationRequestSelect;

export type ReportRow = Prisma.VerificationRequestGetPayload<{ select: typeof REPORT_SELECT }>;

function reportWhere(query: ReportQuery, now: Date) {
  const period = reportPeriod(query.from, query.to, now);
  const where: Prisma.VerificationRequestWhereInput = {
    AND: [
      createdIn(period),
      query.status ? { status: query.status } : {},
      query.decision ? { decisionType: query.decision } : {},
      query.purpose ? { purpose: query.purpose } : {},
      query.org ? { organizationId: query.org } : {},
    ],
  };
  return { where, period };
}

export async function listReport(query: ReportQuery, now: Date = new Date()) {
  const { where, period } = reportWhere(query, now);
  const [rows, total, groups, organizations] = await Promise.all([
    prisma.verificationRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * REPORT_PAGE_SIZE,
      take: REPORT_PAGE_SIZE,
      select: REPORT_SELECT,
    }),
    prisma.verificationRequest.count({ where }),
    prisma.verificationRequest.groupBy({
      by: ["decisionType", "status"],
      where,
      _count: { _all: true },
    }),
    prisma.organization.findMany({
      where: { requests: { some: {} } },
      select: { id: true, nameTh: true, nameEn: true },
      orderBy: { nameTh: "asc" },
    }),
  ]);

  const byStatus: Record<MixStatus, number> = {
    APPROVED: 0,
    PENDING_REVIEW: 0,
    NOT_FOUND: 0,
    REJECTED: 0,
  };
  let auto = 0;
  for (const group of groups) {
    if ((MIX_STATUSES as readonly string[]).includes(group.status)) {
      byStatus[group.status as MixStatus] += group._count._all;
    }
    if (group.decisionType === "AUTO") auto += group._count._all;
  }

  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / REPORT_PAGE_SIZE)),
    period,
    byStatus,
    autoRate: total > 0 ? share(auto, total) : null,
    organizations,
  };
}

export async function* iterateReportRows(query: ReportQuery, now: Date = new Date()) {
  const { where } = reportWhere(query, now);
  let cursor: string | undefined;
  let sent = 0;
  while (sent < REPORT_EXPORT_LIMIT) {
    const batch = await prisma.verificationRequest.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.min(EXPORT_BATCH, REPORT_EXPORT_LIMIT - sent),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: REPORT_SELECT,
    });
    if (batch.length === 0) return;
    yield batch;
    sent += batch.length;
    cursor = batch.at(-1)!.id;
    if (batch.length < EXPORT_BATCH) return;
  }
}

export function recordReportExport(
  actorId: string,
  query: ReportQuery & { format: string },
  context: RequestContext,
  now: Date = new Date(),
) {
  const period = reportPeriod(query.from, query.to, now);
  writeAuditLog({
    action: AuditAction.REPORT_EXPORTED,
    actorId,
    entityType: "Report",
    metadata: {
      format: query.format,
      from: period.fromKey,
      to: period.toKey,
      status: query.status ?? null,
      decision: query.decision ?? null,
      purpose: query.purpose ?? null,
      organizationId: query.org ?? null,
    },
    context,
  });
}

// ------------------------------------------------------------
// F-RPT-01 — แดชบอร์ดผู้ขอ (ขอบเขตเดียวกับรายการคำขอ: หน่วยงานเห็นทั้งหน่วยงาน · ศิษย์เก่าเห็นของตน)
// ------------------------------------------------------------

export async function getRequesterDashboard(userId: string, now: Date = new Date()) {
  const viewer = await loadViewer(userId);
  if (!viewer) return null;
  const scope = visibleTo(viewer);
  const year = bangkokDayKey(now).slice(0, 4);
  const yearStart = new Date(`${year}-01-01T00:00:00+07:00`);

  const [groups, pendingAll, recent, organization] = await Promise.all([
    prisma.verificationRequest.groupBy({
      by: ["status"],
      where: { AND: [scope, { createdAt: { gte: yearStart } }] },
      _count: { _all: true },
    }),
    prisma.verificationRequest.count({ where: { AND: [scope, { status: "PENDING_REVIEW" }] } }),
    prisma.verificationRequest.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        refNo: true,
        status: true,
        purpose: true,
        createdAt: true,
        searchType: true,
        searchValueEnc: true,
        result: {
          select: {
            prefixTh: true,
            firstNameTh: true,
            lastNameTh: true,
            prefixEn: true,
            firstNameEn: true,
            lastNameEn: true,
          },
        },
      },
    }),
    viewer.role === "EXTERNAL" && viewer.organizationId
      ? prisma.organization.findUnique({
          where: { id: viewer.organizationId },
          select: { approvedAt: true, _count: { select: { users: true } } },
        })
      : null,
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const group of groups) {
    counts[group.status] = group._count._all;
    total += group._count._all;
  }
  const approved = counts.APPROVED ?? 0;
  const negative = (counts.NOT_FOUND ?? 0) + (counts.REJECTED ?? 0);

  return {
    scope: viewer.role === "EXTERNAL" ? ("organization" as const) : ("own" as const),
    year: Number(year),
    stats: {
      total,
      pending: counts.PENDING_REVIEW ?? 0,
      approved,
      approvedShare: share(approved, total),
      negative,
      negativeShare: share(negative, total),
    },
    pendingAll,
    recent: recent.map(({ searchValueEnc, ...row }) => ({
      ...row,
      maskedKey: maskSearchValue(row.searchType, searchValueEnc),
    })),
    organization: organization
      ? { approvedAt: organization.approvedAt, members: organization._count.users }
      : null,
  };
}

// ------------------------------------------------------------
// F-RPT-08 — รายงานสรุปประจำเดือนทางอีเมลถึงผู้ดูแลระบบ
// ------------------------------------------------------------

export async function sendMonthlyReport(context: RequestContext, now: Date = new Date()) {
  const settings = await getSettings();
  if (!settings.monthlyReportEnabled) return { status: "disabled" as const };

  const month = previousMonth(now);
  const lastSent = await prisma.appSetting.findUnique({
    where: { key: MONTHLY_REPORT_LAST_SENT_KEY },
  });
  if (lastSent?.value === month.key) return { status: "alreadySent" as const, month: month.key };

  const [summary, organizations, admins] = await Promise.all([
    summarize(month),
    topOrganizations(month, 5),
    prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { email: true, name: true, locale: true },
    }),
  ]);

  const fromKey = `${month.key}-01`;
  const toKey = bangkokDayKey(new Date(month.to.getTime() - 1));
  let sent = 0;
  for (const admin of admins) {
    const locale = admin.locale === "en" ? "en" : "th";
    const ok = await sendMail({
      to: admin.email,
      ...monthlyReportTemplate({
        locale,
        name: admin.name,
        month: month.from,
        summary,
        topOrganizations: organizations,
        url: appUrl(`/staff/reports?from=${fromKey}&to=${toKey}`, locale),
      }),
    });
    if (ok) sent++;
  }

  await prisma.appSetting.upsert({
    where: { key: MONTHLY_REPORT_LAST_SENT_KEY },
    create: { key: MONTHLY_REPORT_LAST_SENT_KEY, value: month.key },
    update: { value: month.key },
  });
  writeAuditLog({
    action: AuditAction.REPORT_MONTHLY_SENT,
    actorId: null,
    entityType: "Report",
    metadata: { month: month.key, recipients: admins.length, sent },
    context,
  });
  return { status: "sent" as const, month: month.key, recipients: admins.length, sent };
}
