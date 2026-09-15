-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NOT_FOUND', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SearchType" AS ENUM ('CITIZEN_ID', 'PASSPORT');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "RequestPurpose" AS ENUM ('EMPLOYMENT', 'FURTHER_STUDY', 'GOVERNMENT_SERVICE', 'BACKGROUND_CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewReason" AS ENUM ('NO_MATCH', 'MULTIPLE_MATCHES', 'MANUAL_FLAG', 'NOT_GRADUATED', 'INCOMPLETE_RECORD', 'AUTO_APPROVE_DISABLED');

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "organizationId" TEXT,
    "searchType" "SearchType" NOT NULL,
    "searchValueHash" TEXT NOT NULL,
    "searchValueEnc" TEXT NOT NULL,
    "purpose" "RequestPurpose" NOT NULL,
    "requesterReference" TEXT,
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewReason" "ReviewReason",
    "matchedStudentId" TEXT,
    "decisionType" "DecisionType",
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "accessTokenHash" TEXT,
    "accessTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_results" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentCode" TEXT NOT NULL,
    "prefixTh" TEXT,
    "firstNameTh" TEXT NOT NULL,
    "lastNameTh" TEXT NOT NULL,
    "prefixEn" TEXT,
    "firstNameEn" TEXT,
    "lastNameEn" TEXT,
    "educationLevel" TEXT NOT NULL,
    "degreeNameTh" TEXT NOT NULL,
    "degreeNameEn" TEXT,
    "programTh" TEXT NOT NULL,
    "programEn" TEXT,
    "majorTh" TEXT,
    "majorEn" TEXT,
    "facultyTh" TEXT NOT NULL,
    "facultyEn" TEXT,
    "gpa" DECIMAL(3,2),
    "honors" "Honors",
    "status" "StudentStatus" NOT NULL,
    "graduationDate" DATE,
    "councilApprovalDate" DATE,
    "sourceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_no_counters" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL,

    CONSTRAINT "ref_no_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" VARCHAR(255) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "expire" BIGINT,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_requests_refNo_key" ON "verification_requests"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "verification_requests_accessTokenHash_key" ON "verification_requests"("accessTokenHash");

-- CreateIndex
CREATE INDEX "verification_requests_requesterId_createdAt_idx" ON "verification_requests"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "verification_requests_organizationId_createdAt_idx" ON "verification_requests"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "verification_requests_status_createdAt_idx" ON "verification_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "verification_requests_searchValueHash_idx" ON "verification_requests"("searchValueHash");

-- CreateIndex
CREATE UNIQUE INDEX "verification_results_requestId_key" ON "verification_results"("requestId");

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_matchedStudentId_fkey" FOREIGN KEY ("matchedStudentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- snapshot ผลตรวจสอบแก้ไขไม่ได้ในระดับฐานข้อมูล (spec ข้อ 4.4 / F-VER-06)
-- ลบได้ (งาน retention F-AUD-08) แต่ UPDATE ถูกปฏิเสธเสมอ แม้เรียกผ่าน SQL ตรง
CREATE OR REPLACE FUNCTION prevent_verification_result_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'verification_results is immutable (id=%)', OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_results_immutable
  BEFORE UPDATE ON "verification_results"
  FOR EACH ROW EXECUTE FUNCTION prevent_verification_result_update();
