import type { Prisma } from "@/generated/prisma/client";
import { encrypt, hashIdentifier, keyedDigest } from "@/lib/crypto";
import type { SyncStudent } from "./types";

// แปลง DTO ระบบทะเบียน → แถวตาราง Student (ไม่มี server-only เพื่อให้ prisma/seed.ts ใช้ร่วมได้)
// เลขบัตร/พาสปอร์ตเก็บเป็น HMAC สำหรับค้นหา + AES-GCM สำหรับให้เจ้าหน้าที่ดู (spec ข้อ 4.5)

export type StudentRow = Omit<Prisma.StudentUncheckedCreateInput, "id" | "createdAt" | "updatedAt">;

function toDate(isoDate: string | null): Date | null {
  return isoDate ? new Date(`${isoDate}T00:00:00.000Z`) : null;
}

// HMAC ของระเบียนตามที่ต้นทางส่งมา (ก่อนเติมรายละเอียด) — ต้นทางบางระบบไม่มีเวลาแก้ไขล่าสุด จึงเทียบเนื้อหาแทน
export function sourceFingerprint(dto: SyncStudent): string {
  return keyedDigest(JSON.stringify(dto));
}

export function toStudentRow(
  dto: SyncStudent,
  syncedAt: Date = new Date(),
  // ต้องคำนวณจากระเบียนก่อน enrichStudent มิฉะนั้น sync รอบถัดไปจะเห็นว่าเปลี่ยนทุกครั้ง
  fingerprint: string = sourceFingerprint(dto),
): StudentRow {
  return {
    studentCode: dto.studentCode,
    citizenIdHash: dto.citizenId ? hashIdentifier(dto.citizenId) : null,
    citizenIdEnc: dto.citizenId ? encrypt(dto.citizenId) : null,
    passportNoHash: dto.passportNo ? hashIdentifier(dto.passportNo) : null,
    passportNoEnc: dto.passportNo ? encrypt(dto.passportNo) : null,
    prefixTh: dto.prefixTh,
    firstNameTh: dto.firstNameTh,
    lastNameTh: dto.lastNameTh,
    prefixEn: dto.prefixEn,
    firstNameEn: dto.firstNameEn,
    lastNameEn: dto.lastNameEn,
    educationLevel: dto.educationLevel,
    degreeNameTh: dto.degreeNameTh,
    degreeNameEn: dto.degreeNameEn,
    programTh: dto.programTh,
    programEn: dto.programEn,
    majorTh: dto.majorTh,
    majorEn: dto.majorEn,
    facultyTh: dto.facultyTh,
    facultyEn: dto.facultyEn,
    gpa: dto.gpa === null ? null : dto.gpa.toFixed(2),
    honors: dto.honors,
    status: dto.status,
    graduationDate: toDate(dto.graduationDate),
    councilApprovalDate: toDate(dto.councilApprovalDate),
    graduationTerm: dto.graduationTerm ?? null,
    registryStatus: dto.registryStatus ?? null,
    requiresManualReview: dto.requiresManualReview,
    sourceUpdatedAt: dto.updatedAt ? new Date(dto.updatedAt) : null,
    sourceLevel: dto.sourceLevel ?? null,
    sourceBatch: dto.sourceBatch ?? null,
    sourceHash: fingerprint,
    // client ตามสัญญาเดิมส่งข้อมูลครบในครั้งเดียว (ไม่มี detailComplete)
    detailSyncedAt: dto.detailComplete === false ? null : syncedAt,
    syncedAt,
  };
}

// ข้ามระเบียนที่ฝั่งทะเบียนไม่ได้แก้ไขตั้งแต่ sync ครั้งก่อน (ciphertext สุ่ม IV ทุกครั้ง จึงเทียบแถวตรง ๆ ไม่ได้)
export function hasSourceChanged(
  storedHash: string | null | undefined,
  fingerprint: string,
): boolean {
  return storedHash !== fingerprint;
}
