import "server-only";
import type { OrgStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendMail } from "@/lib/email/mailer";
import { organizationApprovedTemplate } from "@/lib/email/templates";
import { appUrl } from "@/lib/utils/app-url";
import { getSettings } from "./settings.service";
import {
  AuditAction,
  type AuditActionValue,
  type RequestContext,
  writeAuditLog,
} from "./audit.service";

// F-REG-08 — อนุมัติ / ปฏิเสธ / ระงับ / คืนสิทธิ์หน่วยงาน + ประวัติการใช้งาน
// การระงับมีผลทันที เพราะ session ตรวจสถานะหน่วยงานกับฐานข้อมูลทุกคำขอ (Phase 1)

export const ORG_PAGE_SIZE = 20;
const DAY_MS = 86_400_000;

type Staff = { id: string };
export type OrganizationAction = "approve" | "reject" | "suspend" | "restore";

const TRANSITIONS: Record<
  OrganizationAction,
  { from: OrgStatus; to: OrgStatus; audit: AuditActionValue }
> = {
  approve: { from: "PENDING", to: "APPROVED", audit: AuditAction.ORG_APPROVED },
  reject: { from: "PENDING", to: "SUSPENDED", audit: AuditAction.ORG_REJECTED },
  suspend: { from: "APPROVED", to: "SUSPENDED", audit: AuditAction.ORG_SUSPENDED },
  restore: { from: "SUSPENDED", to: "APPROVED", audit: AuditAction.ORG_RESTORED },
};

export function actionsFor(status: OrgStatus): OrganizationAction[] {
  return (Object.keys(TRANSITIONS) as OrganizationAction[]).filter(
    (action) => TRANSITIONS[action].from === status,
  );
}

export async function listOrganizations(status: OrgStatus, page: number, now: Date = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const [orgs, total, grouped] = await Promise.all([
    prisma.organization.findMany({
      where: { status },
      orderBy: status === "PENDING" ? { createdAt: "asc" } : { nameTh: "asc" },
      skip: (page - 1) * ORG_PAGE_SIZE,
      take: ORG_PAGE_SIZE,
      include: {
        users: {
          orderBy: { createdAt: "asc" },
          select: { name: true, email: true, emailVerifiedAt: true },
        },
        _count: { select: { users: true, requests: true } },
      },
    }),
    prisma.organization.count({ where: { status } }),
    prisma.organization.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const ids = orgs.map((o) => o.id);
  const staffIds = orgs.flatMap((o) => (o.suspendedById ? [o.suspendedById] : []));
  const [recent, recentApproved, lastRequests, suspenders] = await Promise.all([
    prisma.verificationRequest.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: ids }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.verificationRequest.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: ids }, createdAt: { gte: since }, status: "APPROVED" },
      _count: { _all: true },
    }),
    prisma.verificationRequest.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }),
  ]);

  const byOrg = <T extends { organizationId: string | null }>(list: T[]) =>
    new Map(list.map((item) => [item.organizationId, item]));
  const recentMap = byOrg(recent);
  const approvedMap = byOrg(recentApproved);
  const lastMap = byOrg(lastRequests);
  const staffMap = new Map(suspenders.map((s) => [s.id, s.name]));

  const counts: Record<OrgStatus, number> = { PENDING: 0, APPROVED: 0, SUSPENDED: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;

  return {
    rows: orgs.map(({ users, _count, ...org }) => {
      const requests30d = recentMap.get(org.id)?._count._all ?? 0;
      const approved30d = approvedMap.get(org.id)?._count._all ?? 0;
      const contact = users[0] ?? null;
      return {
        ...org,
        contact,
        userCount: _count.users,
        requestCount: _count.requests,
        requests30d,
        approvedRate: requests30d > 0 ? Math.round((approved30d / requests30d) * 100) : null,
        lastRequestAt: lastMap.get(org.id)?._max.createdAt ?? null,
        suspendedByName: org.suspendedById ? (staffMap.get(org.suspendedById) ?? null) : null,
        actions: actionsFor(org.status),
      };
    }),
    total,
    pageCount: Math.max(1, Math.ceil(total / ORG_PAGE_SIZE)),
    counts,
  };
}

export type OrganizationRow = Awaited<ReturnType<typeof listOrganizations>>["rows"][number];

export type OrganizationActionResult =
  { ok: true } | { ok: false; code: "notFound" | "invalidTransition" };

export async function changeOrganizationStatus(
  input: { organizationId: string; action: OrganizationAction; reason?: string },
  staff: Staff,
  context: RequestContext,
): Promise<OrganizationActionResult> {
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, nameTh: true, nameEn: true, approvedAt: true },
  });
  if (!org) return { ok: false, code: "notFound" };

  const transition = TRANSITIONS[input.action];
  const now = new Date();
  const toApproved = transition.to === "APPROVED";

  // เงื่อนไขสถานะต้นทางใน WHERE — กันเจ้าหน้าที่สองคนเปลี่ยนสถานะทับกัน
  const updated = await prisma.organization.updateMany({
    where: { id: org.id, status: transition.from },
    data: toApproved
      ? {
          status: "APPROVED",
          approvedAt: input.action === "approve" ? now : (org.approvedAt ?? now),
          approvedById: input.action === "approve" ? staff.id : undefined,
          suspendedAt: null,
          suspendedById: null,
          statusReason: null,
        }
      : {
          status: "SUSPENDED",
          suspendedAt: now,
          suspendedById: staff.id,
          statusReason: input.reason ?? null,
        },
  });
  if (updated.count === 0) return { ok: false, code: "invalidTransition" };

  writeAuditLog({
    action: transition.audit,
    actorId: staff.id,
    entityType: "Organization",
    entityId: org.id,
    metadata: { from: transition.from, to: transition.to, reason: input.reason ?? null },
    context,
  });

  if (input.action === "approve") {
    const users = await prisma.user.findMany({
      where: { organizationId: org.id, emailVerifiedAt: { not: null }, status: "ACTIVE" },
      select: { email: true, locale: true },
    });
    const quotaPerHour = (await getSettings()).userPerHour;
    for (const user of users) {
      const locale = user.locale === "en" ? "en" : "th";
      void sendMail({
        to: user.email,
        ...organizationApprovedTemplate({
          locale,
          orgName: locale === "en" ? (org.nameEn ?? org.nameTh) : org.nameTh,
          approvedAt: now,
          quotaPerHour,
          url: appUrl("/requests/new", locale),
        }),
      });
    }
  }
  return { ok: true };
}

// ประวัติการใช้งานของหน่วยงาน
export async function getOrganizationDetail(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          position: true,
          status: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
        },
      },
    },
  });
  if (!org) return null;

  const [requests, statusCounts, history] = await Promise.all([
    prisma.verificationRequest.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        refNo: true,
        status: true,
        purpose: true,
        decisionType: true,
        createdAt: true,
        requester: { select: { name: true } },
      },
    }),
    prisma.verificationRequest.groupBy({
      by: ["status"],
      where: { organizationId: id },
      _count: { _all: true },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "Organization", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  return {
    ...org,
    requests,
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
    history,
    actions: actionsFor(org.status),
  };
}

export type OrganizationDetail = NonNullable<Awaited<ReturnType<typeof getOrganizationDetail>>>;
