-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "coverPoNo" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "coverPoNo" TEXT,
ADD COLUMN     "mode" TEXT;

-- CreateTable
CREATE TABLE "shipment_line_allocations" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "mode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'allocated',
    "shippedQty" DECIMAL(18,3),
    "shortQty" DECIMAL(18,3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_line_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_line_allocations_poNo_line_idx" ON "shipment_line_allocations"("poNo", "line");

-- CreateIndex
CREATE INDEX "shipment_line_allocations_shipmentId_idx" ON "shipment_line_allocations"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_line_allocations_purchaseOrderId_idx" ON "shipment_line_allocations"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "shipment_line_allocations_status_idx" ON "shipment_line_allocations"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_coverPoNo_idx" ON "purchase_orders"("coverPoNo");

-- CreateIndex
CREATE INDEX "shipments_coverPoNo_idx" ON "shipments"("coverPoNo");

-- CreateIndex
CREATE INDEX "shipments_mode_idx" ON "shipments"("mode");

-- AddForeignKey
ALTER TABLE "shipment_line_allocations" ADD CONSTRAINT "shipment_line_allocations_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_line_allocations" ADD CONSTRAINT "shipment_line_allocations_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
