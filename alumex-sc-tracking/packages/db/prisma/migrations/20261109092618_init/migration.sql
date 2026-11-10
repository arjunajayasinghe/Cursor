-- CreateEnum
CREATE TYPE "FieldSource" AS ENUM ('S', 'W', 'A', 'E', 'M');

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "prNo" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "date" DATE,
    "purchasingGroup" TEXT,
    "createdBy" TEXT,
    "requester" TEXT,
    "changed" DATE,
    "reportReceived" DATE,
    "reportDate" DATE,
    "reportDelay" INTEGER,
    "delayBand" TEXT,
    "sourcing" TEXT,
    "stockType" TEXT,
    "department" TEXT,
    "plant" TEXT,
    "materialCode" TEXT,
    "material" TEXT,
    "materialGroup" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uom" TEXT,
    "brand" TEXT,
    "need" DATE,
    "approved" DATE,
    "release" TEXT,
    "handler" TEXT,
    "buyer" TEXT,
    "priority" TEXT DEFAULT 'Normal',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "prId" TEXT,
    "purchaseRequisitionId" TEXT,
    "rfq" TEXT,
    "called" DATE,
    "supplierCode" TEXT,
    "supplier" TEXT,
    "received" DATE,
    "quoteRef" TEXT,
    "email" TEXT,
    "currency" TEXT,
    "unitPrice" DECIMAL(18,4),
    "quantity" DECIMAL(18,3),
    "paymentTerms" TEXT,
    "incoterm" TEXT,
    "lead" INTEGER,
    "validity" DATE,
    "technical" TEXT,
    "exception" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "prId" TEXT,
    "purchaseRequisitionId" TEXT,
    "start" DATE,
    "evaluator" TEXT,
    "due" DATE,
    "compliance" TEXT,
    "recommended" TEXT,
    "compare" TEXT,
    "technical" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "decisions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "prId" TEXT,
    "purchaseRequisitionId" TEXT,
    "poNo" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "date" DATE,
    "supplierCode" TEXT,
    "supplier" TEXT,
    "materialCode" TEXT,
    "material" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uom" TEXT,
    "currency" TEXT,
    "unitPrice" DECIMAL(18,4),
    "paymentTerms" TEXT,
    "incoterm" TEXT,
    "approval" TEXT,
    "approved" DATE,
    "sapNeed" DATE,
    "sent" DATE,
    "importNo" TEXT,
    "piNo" TEXT,
    "piDate" DATE,
    "piAmount" DECIMAL(18,2),
    "production" INTEGER,
    "transit" INTEGER,
    "supplierEta" DATE,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "poId" TEXT,
    "purchaseOrderId" TEXT,
    "method" TEXT,
    "due" DATE,
    "currency" TEXT,
    "amount" DECIMAL(18,2),
    "bank" TEXT,
    "bankDate" DATE,
    "reference" TEXT,
    "lcNo" TEXT,
    "lcDate" DATE,
    "maturity" DATE,
    "completed" DATE,
    "paid" DECIMAL(18,2),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_confirmations" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "poId" TEXT,
    "purchaseOrderId" TEXT,
    "supplier" TEXT,
    "contact" TEXT,
    "acknowledged" DATE,
    "confirmedQuantity" DECIMAL(18,3),
    "production" DATE,
    "ready" DATE,
    "shipBy" DATE,
    "revised" DATE,
    "reason" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Awaiting response',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "poId" TEXT,
    "purchaseOrderId" TEXT,
    "importNo" TEXT,
    "booking" TEXT,
    "booked" DATE,
    "forwarder" TEXT,
    "carrier" TEXT,
    "vessel" TEXT,
    "voyage" TEXT,
    "bl" TEXT,
    "blDate" DATE,
    "container" TEXT,
    "seal" TEXT,
    "weight" DECIMAL(18,3),
    "packages" INTEGER,
    "loading" TEXT,
    "destination" TEXT,
    "etd" DATE,
    "atd" DATE,
    "eta" DATE,
    "etaRevised" DATE,
    "arrived" DATE,
    "invoice" TEXT,
    "packing" TEXT,
    "origin" TEXT,
    "insurance" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Booking pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vessel_trackings" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "vessel" TEXT,
    "imo" TEXT,
    "voyage" TEXT,
    "position" TEXT,
    "updated" DATE,
    "eta" DATE,
    "etaRevised" DATE,
    "arrived" DATE,
    "reason" TEXT,
    "tracking" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Awaiting departure',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessel_trackings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_clearances" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "broker" TEXT,
    "declaration" TEXT,
    "filed" DATE,
    "hs" TEXT,
    "assessment" TEXT,
    "value" DECIMAL(18,2),
    "duty" DECIMAL(18,2),
    "tax" DECIMAL(18,2),
    "paidDate" DATE,
    "inspection" DATE,
    "permit" TEXT,
    "order" TEXT,
    "released" DATE,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Awaiting documents',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customs_clearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_landed_costs" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "site" TEXT,
    "transport" TEXT,
    "vehicle" TEXT,
    "dispatch" DATE,
    "delivered" DATE,
    "quantity" DECIMAL(18,3),
    "uom" TEXT,
    "currency" TEXT,
    "goods" DECIMAL(18,2),
    "fx" DECIMAL(18,6),
    "freight" DECIMAL(18,2),
    "insurance" DECIMAL(18,2),
    "duty" DECIMAL(18,2),
    "handling" DECIMAL(18,2),
    "demurrage" DECIMAL(18,2),
    "local" DECIMAL(18,2),
    "other" DECIMAL(18,2),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Dispatch pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_landed_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "prId" TEXT,
    "poId" TEXT,
    "grnNo" TEXT,
    "year" INTEGER,
    "item" TEXT,
    "movement" TEXT,
    "posted" DATE,
    "plant" TEXT,
    "location" TEXT,
    "received" DECIMAL(18,3),
    "accepted" DECIMAL(18,3),
    "uom" TEXT,
    "quality" TEXT,
    "closed" DATE,
    "closedBy" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Awaiting posting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_recordId_key" ON "purchase_requisitions"("recordId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_prNo_idx" ON "purchase_requisitions"("prNo");

-- CreateIndex
CREATE INDEX "purchase_requisitions_status_idx" ON "purchase_requisitions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_prNo_line_key" ON "purchase_requisitions"("prNo", "line");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_recordId_key" ON "quotations"("recordId");

-- CreateIndex
CREATE INDEX "quotations_prId_idx" ON "quotations"("prId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_recordId_key" ON "evaluations"("recordId");

-- CreateIndex
CREATE INDEX "evaluations_prId_idx" ON "evaluations"("prId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_recordId_key" ON "purchase_orders"("recordId");

-- CreateIndex
CREATE INDEX "purchase_orders_poNo_idx" ON "purchase_orders"("poNo");

-- CreateIndex
CREATE INDEX "purchase_orders_prId_idx" ON "purchase_orders"("prId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNo_line_key" ON "purchase_orders"("poNo", "line");

-- CreateIndex
CREATE UNIQUE INDEX "payments_recordId_key" ON "payments"("recordId");

-- CreateIndex
CREATE INDEX "payments_poId_idx" ON "payments"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_confirmations_recordId_key" ON "supplier_confirmations"("recordId");

-- CreateIndex
CREATE INDEX "supplier_confirmations_poId_idx" ON "supplier_confirmations"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_recordId_key" ON "shipments"("recordId");

-- CreateIndex
CREATE INDEX "shipments_poId_idx" ON "shipments"("poId");

-- CreateIndex
CREATE INDEX "shipments_importNo_idx" ON "shipments"("importNo");

-- CreateIndex
CREATE UNIQUE INDEX "vessel_trackings_recordId_key" ON "vessel_trackings"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "customs_clearances_recordId_key" ON "customs_clearances"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_landed_costs_recordId_key" ON "delivery_landed_costs"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_recordId_key" ON "goods_receipts"("recordId");

-- CreateIndex
CREATE INDEX "goods_receipts_prId_idx" ON "goods_receipts"("prId");

-- CreateIndex
CREATE INDEX "goods_receipts_poId_idx" ON "goods_receipts"("poId");

-- CreateIndex
CREATE INDEX "audit_events_moduleKey_recordId_idx" ON "audit_events"("moduleKey", "recordId");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchaseRequisitionId_fkey" FOREIGN KEY ("purchaseRequisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_confirmations" ADD CONSTRAINT "supplier_confirmations_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_trackings" ADD CONSTRAINT "vessel_trackings_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_clearances" ADD CONSTRAINT "customs_clearances_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_landed_costs" ADD CONSTRAINT "delivery_landed_costs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
