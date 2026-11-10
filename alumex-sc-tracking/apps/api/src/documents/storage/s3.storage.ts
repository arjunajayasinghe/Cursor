import { Injectable, Logger } from "@nestjs/common";
import { ObjectStorage, StoredObject } from "./storage.interface";

/**
 * S3-compatible stub. When S3_ENDPOINT / S3_BUCKET are unset, callers should
 * use LocalObjectStorage. When set, this performs a minimal PUT/GET via the
 * S3 REST API shape (path-style) — sufficient as a phase-1 interface.
 */
@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  readonly backend = "s3" as const;
  private readonly log = new Logger(S3ObjectStorage.name);

  get configured() {
    return Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET);
  }

  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    if (!this.configured) {
      throw new Error("S3 storage is not configured (set S3_ENDPOINT and S3_BUCKET)");
    }
    const endpoint = process.env.S3_ENDPOINT!.replace(/\/$/, "");
    const bucket = process.env.S3_BUCKET!;
    const url = `${endpoint}/${bucket}/${key}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(data.length),
        ...(process.env.S3_ACCESS_KEY ? { "x-amz-meta-demo": "alumex" } : {}),
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      this.log.warn(`S3 PUT failed ${res.status}`);
      throw new Error(`S3 PUT failed (${res.status})`);
    }
    return {
      storageBackend: "s3",
      storageKey: key,
      sizeBytes: data.length,
      contentType,
    };
  }

  async get(key: string) {
    if (!this.configured) {
      throw new Error("S3 storage is not configured");
    }
    const endpoint = process.env.S3_ENDPOINT!.replace(/\/$/, "");
    const bucket = process.env.S3_BUCKET!;
    const url = `${endpoint}/${bucket}/${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`S3 GET failed (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      data: buf,
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  }
}
