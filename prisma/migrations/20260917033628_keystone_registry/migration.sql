-- AlterTable
ALTER TABLE "students" ADD COLUMN     "detailSyncedAt" TIMESTAMP(3),
ADD COLUMN     "graduationTerm" TEXT,
ADD COLUMN     "registryStatus" TEXT,
ADD COLUMN     "sourceBatch" INTEGER,
ADD COLUMN     "sourceHash" TEXT,
ADD COLUMN     "sourceLevel" INTEGER;

-- AlterTable
ALTER TABLE "sync_jobs" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "verification_results" ADD COLUMN     "graduationTerm" TEXT;
