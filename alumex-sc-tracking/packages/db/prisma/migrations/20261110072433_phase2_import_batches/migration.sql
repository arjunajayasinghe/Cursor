-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "integrationKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "fileName" TEXT,
    "format" TEXT NOT NULL DEFAULT 'csv',
    "actor" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "mismatchCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "payloadExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledAt" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_integrationKey_createdAt_idx" ON "import_batches"("integrationKey", "createdAt");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_integrationKey_fkey" FOREIGN KEY ("integrationKey") REFERENCES "integration_register"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
