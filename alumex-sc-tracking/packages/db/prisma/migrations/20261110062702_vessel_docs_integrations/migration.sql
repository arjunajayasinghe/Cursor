-- AlterTable
ALTER TABLE "vessel_trackings" ADD COLUMN     "apiEta" DATE,
ADD COLUMN     "courseDeg" DOUBLE PRECISION,
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "lastAisAt" TIMESTAMP(3),
ADD COLUMN     "lastPollAt" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "mmsi" TEXT,
ADD COLUMN     "speedKnots" DOUBLE PRECISION,
ADD COLUMN     "trackingProvider" TEXT;

-- CreateTable
CREATE TABLE "vessel_tracking_events" (
    "id" TEXT NOT NULL,
    "vesselTrackingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "imo" TEXT,
    "mmsi" TEXT,
    "vesselName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "speedKnots" DOUBLE PRECISION,
    "courseDeg" DOUBLE PRECISION,
    "destination" TEXT,
    "apiEta" TIMESTAMP(3),
    "aisTimestamp" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_assets" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "storageBackend" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT,
    "uploadedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vessel_tracking_events_vesselTrackingId_createdAt_idx" ON "vessel_tracking_events"("vesselTrackingId", "createdAt");

-- CreateIndex
CREATE INDEX "vessel_tracking_events_imo_idx" ON "vessel_tracking_events"("imo");

-- CreateIndex
CREATE INDEX "vessel_tracking_events_mmsi_idx" ON "vessel_tracking_events"("mmsi");

-- CreateIndex
CREATE INDEX "document_assets_moduleKey_recordId_idx" ON "document_assets"("moduleKey", "recordId");

-- CreateIndex
CREATE INDEX "document_assets_category_idx" ON "document_assets"("category");

-- CreateIndex
CREATE INDEX "vessel_trackings_imo_idx" ON "vessel_trackings"("imo");

-- CreateIndex
CREATE INDEX "vessel_trackings_mmsi_idx" ON "vessel_trackings"("mmsi");

-- AddForeignKey
ALTER TABLE "vessel_tracking_events" ADD CONSTRAINT "vessel_tracking_events_vesselTrackingId_fkey" FOREIGN KEY ("vesselTrackingId") REFERENCES "vessel_trackings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
