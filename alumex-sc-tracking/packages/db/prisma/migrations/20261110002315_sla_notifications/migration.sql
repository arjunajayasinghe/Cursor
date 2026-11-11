-- CreateTable
CREATE TABLE "sla_rules" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleKey" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'hours',
    "targetValue" INTEGER NOT NULL,
    "loadType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleKey" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'Reminder',
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "recipientRoles" TEXT NOT NULL DEFAULT 'Procurement',
    "channels" TEXT NOT NULL DEFAULT 'in_app,email',
    "dedupeHours" INTEGER NOT NULL DEFAULT 24,
    "slaKey" TEXT,
    "escalateAfterHours" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "action" TEXT NOT NULL DEFAULT 'Reminder',
    "recipientRoles" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "href" TEXT,
    "ageHours" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ackAt" TIMESTAMP(3),
    "ackBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "toRoles" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_register" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "triggerKey" TEXT,
    "category" TEXT NOT NULL DEFAULT 'SLA',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'open',
    "ownerRole" TEXT,
    "authorizedBy" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exception_register_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_rules_key_key" ON "sla_rules"("key");

-- CreateIndex
CREATE INDEX "sla_rules_moduleKey_idx" ON "sla_rules"("moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "notification_rules_triggerKey_key" ON "notification_rules"("triggerKey");

-- CreateIndex
CREATE INDEX "notification_rules_moduleKey_idx" ON "notification_rules"("moduleKey");

-- CreateIndex
CREATE INDEX "notification_events_status_lastSeenAt_idx" ON "notification_events"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "notification_events_moduleKey_recordId_idx" ON "notification_events"("moduleKey", "recordId");

-- CreateIndex
CREATE INDEX "notification_events_triggerKey_idx" ON "notification_events"("triggerKey");

-- CreateIndex
CREATE UNIQUE INDEX "notification_events_dedupeKey_key" ON "notification_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "email_outbox_status_createdAt_idx" ON "email_outbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "exception_register_status_moduleKey_idx" ON "exception_register"("status", "moduleKey");

-- CreateIndex
CREATE INDEX "exception_register_recordId_idx" ON "exception_register"("recordId");
