import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import { ObjectStorage, StoredObject } from "./storage.interface";

@Injectable()
export class LocalObjectStorage implements ObjectStorage {
  readonly backend = "local" as const;
  private readonly root =
    process.env.DOCUMENT_STORAGE_PATH ||
    path.resolve(process.cwd(), process.cwd().endsWith("apps/api") ? "../.." : ".", "storage", "documents");

  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    const full = path.join(this.root, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return {
      storageBackend: "local",
      storageKey: key,
      sizeBytes: data.length,
      contentType,
    };
  }

  async get(key: string) {
    const full = path.join(this.root, key);
    const data = await fs.readFile(full);
    return { data, contentType: "application/octet-stream" };
  }

  async delete(key: string) {
    const full = path.join(this.root, key);
    await fs.unlink(full).catch(() => undefined);
  }

  checksum(data: Buffer) {
    return createHash("sha256").update(data).digest("hex");
  }
}
