-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "newValue" TEXT,
ADD COLUMN     "oldValue" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "master_data_entries" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extra" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_data_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_register" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'sap_import',
    "channel" TEXT NOT NULL DEFAULT 'csv',
    "status" TEXT NOT NULL DEFAULT 'stub',
    "description" TEXT,
    "fieldPriority" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "lastResult" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_actions" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "master_data_entries_category_active_idx" ON "master_data_entries"("category", "active");

-- CreateIndex
CREATE UNIQUE INDEX "master_data_entries_category_code_key" ON "master_data_entries"("category", "code");

-- CreateIndex
CREATE UNIQUE INDEX "integration_register_key_key" ON "integration_register"("key");

-- CreateIndex
CREATE INDEX "workflow_actions_moduleKey_recordId_idx" ON "workflow_actions"("moduleKey", "recordId");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");
