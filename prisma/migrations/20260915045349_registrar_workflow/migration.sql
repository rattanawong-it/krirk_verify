-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedById" TEXT;

-- AlterTable
ALTER TABLE "verification_requests" ADD COLUMN     "rejectDetail" TEXT;

-- CreateTable
CREATE TABLE "request_notes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_notes_requestId_createdAt_idx" ON "request_notes"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
