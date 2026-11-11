export type StoredObject = {
  storageBackend: "local" | "s3";
  storageKey: string;
  sizeBytes: number;
  contentType: string;
};

export interface ObjectStorage {
  readonly backend: "local" | "s3";
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<{ data: Buffer; contentType: string }>;
  delete?(key: string): Promise<void>;
}
