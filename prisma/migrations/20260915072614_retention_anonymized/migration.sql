-- AlterTable
ALTER TABLE "verification_requests" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "verification_requests_anonymizedAt_decidedAt_idx" ON "verification_requests"("anonymizedAt", "decidedAt");
