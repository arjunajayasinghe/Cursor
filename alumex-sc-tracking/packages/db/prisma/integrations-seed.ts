import { createHash } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const ROOT =
  process.env.DOCUMENT_STORAGE_PATH ||
  path.resolve(__dirname, "..", "..", "..", "storage", "documents");

async function writeSample(relKey: string, contents: string) {
  const full = path.join(ROOT, relKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const buf = Buffer.from(contents, "utf8");
  await fs.writeFile(full, buf);
  return { buf, full };
}

/** Seed vessel tracking events + sample document register entries. */
export async function seedIntegrations(prisma: PrismaClient) {
  const trackings = await prisma.vesselTracking.findMany({ orderBy: { recordId: "asc" } });

  // Enrich vessel rows with MMSI / coords without touching supplier ETAs
  for (const [i, row] of trackings.entries()) {
    const isKestrel = (row.vessel || "").includes("Kestrel");
    const imo = row.imo || (isKestrel ? "9123456" : "9876543");
    const mmsi = isKestrel ? "417000222" : "417000111";
    const lat = 6.8 + i * 0.15;
    const lon = 78.9 + i * 0.12;
    await prisma.vesselTracking.update({
      where: { id: row.id },
      data: {
        imo,
        mmsi,
        latitude: lat,
        longitude: lon,
        speedKnots: 11 + (i % 4),
        courseDeg: 90 + i * 3,
        destination: "Colombo",
        position: `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
        // apiEta only — leave eta / etaRevised alone
        apiEta: row.etaRevised || row.eta,
        lastAisAt: new Date(),
        trackingProvider: "mock",
        lastPollAt: new Date(),
      },
    });

    // Historical events trail
    for (let step = 0; step < 3; step++) {
      const when = new Date(Date.now() - (3 - step) * 3600_000);
      await prisma.vesselTrackingEvent.create({
        data: {
          vesselTrackingId: row.id,
          provider: "mock",
          imo,
          mmsi,
          vesselName: row.vessel,
          latitude: lat - (3 - step) * 0.05,
          longitude: lon - (3 - step) * 0.04,
          speedKnots: 10 + step,
          courseDeg: 88 + step,
          destination: "Colombo",
          apiEta: row.eta,
          aisTimestamp: when,
          rawPayload: { seed: true, step },
          createdAt: when,
        },
      });
    }
  }

  // Sample documents across categories
  const samples: Array<{
    category: string;
    moduleKey: string;
    recordId: string;
    fileName: string;
    body: string;
  }> = [];

  const pr = await prisma.purchaseRequisition.findFirst({ orderBy: { recordId: "asc" } });
  if (pr) {
    samples.push({
      category: "pr",
      moduleKey: "pr",
      recordId: pr.recordId,
      fileName: "pr-justification.txt",
      body: `Demo PR attachment for ${pr.prNo}/${pr.line}\nMaterial: ${pr.material}\n`,
    });
  }
  const quote = await prisma.quotation.findFirst({ orderBy: { recordId: "asc" } });
  if (quote) {
    samples.push({
      category: "quotes",
      moduleKey: "quotes",
      recordId: quote.recordId,
      fileName: "supplier-quote.txt",
      body: `Quotation ${quote.quoteRef || quote.recordId}\nSupplier: ${quote.supplier}\n`,
    });
  }
  const po = await prisma.purchaseOrder.findFirst({ orderBy: { recordId: "asc" } });
  if (po) {
    samples.push({
      category: "po",
      moduleKey: "po",
      recordId: po.recordId,
      fileName: "proforma-invoice.txt",
      body: `PI for PO ${po.poNo}\nAmount: ${po.piAmount || po.unitPrice}\n`,
    });
  }
  const pay = await prisma.payment.findFirst({ orderBy: { recordId: "asc" } });
  if (pay) {
    samples.push({
      category: "pay",
      moduleKey: "pay",
      recordId: pay.recordId,
      fileName: "bank-advice.txt",
      body: `Payment ${pay.recordId}\nMethod: ${pay.method}\n`,
    });
  }
  const ship = await prisma.shipment.findFirst({ orderBy: { recordId: "asc" } });
  if (ship) {
    samples.push({
      category: "ship",
      moduleKey: "ship",
      recordId: ship.recordId,
      fileName: "bill-of-lading.txt",
      body: `B/L ${ship.bl}\nVessel: ${ship.vessel}\n`,
    });
  }
  const customs = await prisma.customsClearance.findFirst({ orderBy: { recordId: "asc" } });
  if (customs) {
    samples.push({
      category: "customs",
      moduleKey: "customs",
      recordId: customs.recordId,
      fileName: "cusdec-pack.txt",
      body: `CUSDEC ${customs.declaration}\nBroker: ${customs.broker}\n`,
    });
  }
  const grn = await prisma.goodsReceipt.findFirst({ orderBy: { recordId: "asc" } });
  if (grn) {
    samples.push({
      category: "grn",
      moduleKey: "grn",
      recordId: grn.recordId,
      fileName: "grn-scan.txt",
      body: `GRN ${grn.grnNo || grn.recordId}\nPlant: ${grn.plant}\n`,
    });
  }

  for (const s of samples) {
    const key = `${s.moduleKey}/${s.recordId}/seed-${s.fileName}`;
    const { buf } = await writeSample(key, s.body);
    await prisma.documentAsset.create({
      data: {
        category: s.category,
        moduleKey: s.moduleKey,
        recordId: s.recordId,
        fileName: s.fileName,
        contentType: "text/plain",
        sizeBytes: buf.length,
        storageBackend: "local",
        storageKey: key,
        checksum: createHash("sha256").update(buf).digest("hex"),
        uploadedBy: "seed",
        notes: "Demo document register entry",
      },
    });
  }
}
