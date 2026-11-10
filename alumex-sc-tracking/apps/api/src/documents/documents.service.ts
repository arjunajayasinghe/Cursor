import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LocalObjectStorage } from "./storage/local.storage";
import { S3ObjectStorage } from "./storage/s3.storage";

export const DOCUMENT_CATEGORIES = [
  "pr",
  "quotes",
  "po",
  "pay",
  "ship",
  "customs",
  "grn",
  "eval",
  "confirm",
  "vessel",
  "delivery",
] as const;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly local: LocalObjectStorage,
    private readonly s3: S3ObjectStorage,
  ) {}

  private storage() {
    return this.s3.configured ? this.s3 : this.local;
  }

  list(moduleKey: string, recordId: string) {
    return this.prisma.documentAsset.findMany({
      where: { moduleKey, recordId },
      orderBy: { createdAt: "desc" },
    });
  }

  listByCategory(category: string) {
    return this.prisma.documentAsset.findMany({
      where: { category },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getMeta(id: string) {
    const row = await this.prisma.documentAsset.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Document ${id} not found`);
    return row;
  }

  async upload(input: {
    category: string;
    moduleKey: string;
    recordId: string;
    fileName: string;
    contentType: string;
    data: Buffer;
    uploadedBy?: string;
    notes?: string;
  }) {
    const storage = this.storage();
    const safeName = input.fileName.replace(/[^\w.\-()+ ]+/g, "_");
    const key = `${input.moduleKey}/${input.recordId}/${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`;
    const stored = await storage.put(key, input.data, input.contentType || "application/octet-stream");
    const checksum = createHash("sha256").update(input.data).digest("hex");
    return this.prisma.documentAsset.create({
      data: {
        category: input.category,
        moduleKey: input.moduleKey,
        recordId: input.recordId,
        fileName: input.fileName,
        contentType: input.contentType || "application/octet-stream",
        sizeBytes: stored.sizeBytes,
        storageBackend: stored.storageBackend,
        storageKey: stored.storageKey,
        checksum,
        uploadedBy: input.uploadedBy,
        notes: input.notes,
      },
    });
  }

  async download(id: string) {
    const meta = await this.getMeta(id);
    const storage = meta.storageBackend === "s3" && this.s3.configured ? this.s3 : this.local;
    const file = await storage.get(meta.storageKey);
    return { meta, ...file, contentType: meta.contentType || file.contentType };
  }

  async remove(id: string) {
    const meta = await this.getMeta(id);
    if (meta.storageBackend === "local") await this.local.delete?.(meta.storageKey);
    await this.prisma.documentAsset.delete({ where: { id } });
    return { ok: true, id };
  }
}
