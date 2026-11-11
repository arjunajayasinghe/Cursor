-- AlterTable
ALTER TABLE "integration_register" ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "sapClient" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "sapClient" TEXT;

-- AlterTable
ALTER TABLE "purchase_requisitions" ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "sapClient" TEXT;

-- CreateTable
CREATE TABLE "integration_sync_jobs" (
    "id" TEXT NOT NULL,
    "integrationKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT '0 */6 * * *',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "sapClient" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastResult" TEXT,
    "lastError" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_mismatches" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "existingValue" TEXT,
    "incomingValue" TEXT,
    "preferredSource" TEXT NOT NULL DEFAULT 'S',
    "action" TEXT NOT NULL DEFAULT 'exception',
    "status" TEXT NOT NULL DEFAULT 'open',
    "integrationKey" TEXT,
    "batchId" TEXT,
    "detail" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_mismatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_sync_jobs_integrationKey_enabled_idx" ON "integration_sync_jobs"("integrationKey", "enabled");

-- CreateIndex
CREATE INDEX "field_mismatches_moduleKey_recordId_status_idx" ON "field_mismatches"("moduleKey", "recordId", "status");

-- CreateIndex
CREATE INDEX "field_mismatches_status_createdAt_idx" ON "field_mismatches"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_integrationKey_fkey" FOREIGN KEY ("integrationKey") REFERENCES "integration_register"("key") ON DELETE CASCADE ON UPDATE CASCADE;
