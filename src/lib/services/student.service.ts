import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { decrypt, hashIdentifier, maskCitizenId, maskPassportNo } from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";
import {
  formatCitizenId,
  isRegistryStudentCode,
  isValidPassportNo,
  isValidThaiCitizenId,
  stripIdentifier,
} from "@/lib/validations/identifiers";
import type { StudentQuery } from "@/lib/validations/review";
import { buildFacultyOptions } from "@/lib/verification/faculty-options";
import { AuditAction, type RequestContext, writeAuditLog } from "./audit.service";

// F-REG-03 / F-REG-07 — ค้นหาและดูข้อมูลผู้สำเร็จการศึกษา (เจ้าหน้าที่เท่านั้น)

export const STUDENT_PAGE_SIZE = 20;

type Staff = { id: string };

function searchKind(q: string): "identifier" | "code" | "name" {
  const key = stripIdentifier(q);
  if (isValidThaiCitizenId(key) || (isValidPassportNo(key) && /\d/.test(key))) return "identifier";
  if (/^\d+$/.test(key)) return "code";
  return "name";
}

export function studentSearchWhere(q: string | undefined): Prisma.StudentWhereInput {
  const text = q?.trim();
  if (!text) return {};

  const key = stripIdentifier(text);
  const conditions: Prisma.StudentWhereInput[] = [];
  if (/^\d{2,10}$/.test(key)) conditions.push({ studentCode: { startsWith: key } });
  if (isValidThaiCitizenId(key)) conditions.push({ citizenIdHash: hashIdentifier(key) });
  if (isValidPassportNo(key)) conditions.push({ passportNoHash: hashIdentifier(key) });

  const tokens = text.split(/\s+/).filter(Boolean).slice(0, 3);
  const like = (token: string) => ({ contains: token, mode: "insensitive" as const });
  conditions.push({
    AND: tokens.map((token) => ({
      OR: [
        { firstNameTh: like(token) },
        { lastNameTh: like(token) },
        { firstNameEn: like(token) },
        { lastNameEn: like(token) },
      ],
    })),
  });
  return { OR: conditions };
}

// ตัวเลือกคณะใช้ชื่ออังกฤษเป็นค่า (ดู faculty-options.ts) · รับชื่อไทยด้วยเพื่อให้ลิงก์เดิมยังใช้ได้
function facultyWhere(faculty: string): Prisma.StudentWhereInput {
  return {
    OR: [{ facultyEn: faculty }, { facultyEn: null, facultyTh: faculty }, { facultyTh: faculty }],
  };
}

export async function searchStudents(query: StudentQuery, staff: Staff, context: RequestContext) {
  const where: Prisma.StudentWhereInput = {
    AND: [
      studentSearchWhere(query.q),
      query.faculty ? facultyWhere(query.faculty) : {},
      query.status ? { status: query.status } : {},
      query.flagged ? { requiresManualReview: true } : {},
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { studentCode: "asc" },
      skip: (query.page - 1) * STUDENT_PAGE_SIZE,
      take: STUDENT_PAGE_SIZE,
      select: {
        id: true,
        studentCode: true,
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
        facultyTh: true,
        facultyEn: true,
        status: true,
        graduationDate: true,
        graduationTerm: true,
        requiresManualReview: true,
      },
    }),
    prisma.student.count({ where }),
  ]);

  // บันทึกการค้นหาข้อมูลส่วนบุคคล โดยไม่เก็บคำค้น (อาจเป็นเลขบัตร)
  if (query.q) {
    writeAuditLog({
      action: AuditAction.STUDENT_SEARCHED,
      actorId: staff.id,
      entityType: "Student",
      metadata: { kind: searchKind(query.q), results: total },
      context,
    });
  }

  return { rows, total, pageCount: Math.max(1, Math.ceil(total / STUDENT_PAGE_SIZE)) };
}

export type StudentRow = Awaited<ReturnType<typeof searchStudents>>["rows"][number];

// ค้นหาเพื่อเลือกจับคู่ในหน้าพิจารณา (F-REG-03)
export async function findStudentsForMatching(q: string, staff: Staff, context: RequestContext) {
  if (!q.trim()) return [];
  const rows = await prisma.student.findMany({
    where: studentSearchWhere(q),
    orderBy: { studentCode: "asc" },
    take: 8,
  });
  writeAuditLog({
    action: AuditAction.STUDENT_SEARCHED,
    actorId: staff.id,
    entityType: "Student",
    metadata: { kind: searchKind(q), results: rows.length, via: "review" },
    context,
  });
  return rows;
}

export async function getRegistrySummary() {
  const [total, graduated, flagged, passport, faculties] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: "GRADUATED" } }),
    prisma.student.count({ where: { requiresManualReview: true } }),
    prisma.student.count({ where: { passportNoHash: { not: null } } }),
    prisma.student.findMany({
      distinct: ["facultyEn", "facultyTh"],
      select: { facultyTh: true, facultyEn: true },
    }),
  ]);
  return { total, graduated, flagged, passport, faculties: buildFacultyOptions(faculties) };
}

export async function getStudentDetail(studentCode: string, staff: Staff, context: RequestContext) {
  if (!isRegistryStudentCode(studentCode)) return null;
  const student = await prisma.student.findUnique({ where: { studentCode } });
  if (!student) return null;

  const requests = await prisma.verificationRequest.findMany({
    where: {
      OR: [{ matchedStudentId: student.id }, { result: { is: { studentId: student.id } } }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      refNo: true,
      status: true,
      decisionType: true,
      createdAt: true,
      requester: { select: { name: true } },
      organization: { select: { nameTh: true, nameEn: true } },
    },
  });

  writeAuditLog({
    action: AuditAction.STUDENT_VIEWED,
    actorId: staff.id,
    entityType: "Student",
    entityId: student.id,
    metadata: { studentCode },
    context,
  });

  const { citizenIdEnc, passportNoEnc, citizenIdHash: _c, passportNoHash: _p, ...rest } = student;
  return {
    ...rest,
    maskedCitizenId: citizenIdEnc ? maskCitizenId(decrypt(citizenIdEnc)) : null,
    maskedPassportNo: passportNoEnc ? maskPassportNo(decrypt(passportNoEnc)) : null,
    requests,
  };
}

export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudentDetail>>>;

export async function revealStudentIdentifier(
  studentCode: string,
  field: "citizenId" | "passportNo",
  staff: Staff,
  context: RequestContext,
): Promise<string | null> {
  const student = await prisma.student.findUnique({
    where: { studentCode },
    select: { id: true, citizenIdEnc: true, passportNoEnc: true },
  });
  const encrypted = field === "citizenId" ? student?.citizenIdEnc : student?.passportNoEnc;
  if (!student || !encrypted) return null;

  writeAuditLog({
    action: AuditAction.PERSONAL_DATA_REVEALED,
    actorId: staff.id,
    entityType: "Student",
    entityId: student.id,
    metadata: { studentCode, field },
    context,
  });
  const value = decrypt(encrypted);
  return field === "citizenId" ? formatCitizenId(value) : value;
}
