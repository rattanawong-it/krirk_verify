-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('DRAFT', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchItemStatus" AS ENUM ('PENDING', 'INVALID', 'APPROVED', 'PENDING_REVIEW', 'NOT_FOUND', 'REJECTED', 'ERROR');

-- CreateTable
CREATE TABLE "batch_jobs" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "purpose" "RequestPurpose" NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "status" "BatchStatus" NOT NULL DEFAULT 'DRAFT',
    "errorMessage" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_items" (
    "id" TEXT NOT NULL,
    "batchJobId" TEXT NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "searchType" "SearchType",
    "searchValueEnc" TEXT,
    "searchValueMasked" TEXT NOT NULL,
    "resultStatus" "BatchItemStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "requestId" TEXT,
    "refNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_jobs_requesterId_createdAt_idx" ON "batch_jobs"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "batch_jobs_status_createdAt_idx" ON "batch_jobs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "batch_items_requestId_key" ON "batch_items"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "batch_items_batchJobId_rowNo_key" ON "batch_items"("batchJobId", "rowNo");

-- AddForeignKey
ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_batchJobId_fkey" FOREIGN KEY ("batchJobId") REFERENCES "batch_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "verification_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
