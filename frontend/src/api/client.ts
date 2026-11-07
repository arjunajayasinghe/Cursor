import createClient from "openapi-fetch";
import type { components, paths } from "./generated/schema";
import { getApiKey } from "./session";

export type SaleSummary = components["schemas"]["SaleSummaryDto"];
export type SaleDetail = components["schemas"]["SaleDetailDto"];
export type Lot = components["schemas"]["LotDto"];
export type UploadBatch = components["schemas"]["UploadBatchDto"];
export type UploadDetail = components["schemas"]["UploadDetailDto"];
export type UploadAccepted = components["schemas"]["UploadAcceptedDto"];
export type AuctionCentre = components["schemas"]["AuctionCentre"];

const api = createClient<paths>({
  // Prefer same-origin (Vite /api proxy) when VITE_API_BASE_URL is unset or blank.
  baseUrl: (import.meta.env.VITE_API_BASE_URL ?? "").trim() || "",
});


function headers() {
  return { "X-Api-Key": getApiKey() };
}

function failure(error: unknown, status: number) {
  if (status === 401) return "The API key was rejected.";
  if (status === 404) return "That record was not found.";
  if (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)) {
    return error.errors.join(" ");
  }
  return `The request failed (${status}).`;
}

async function unwrap<T>(pending: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const result = await pending;
  if (result.response.ok && result.data !== undefined) return result.data;
  throw new Error(failure(result.error, result.response.status));
}

export function listSales() {
  return unwrap(api.GET("/api/sales", { headers: headers() }));
}

export function getSale(id: string) {
  return unwrap(api.GET("/api/sales/{id}", { params: { path: { id } }, headers: headers() }));
}

export function listUploads() {
  return unwrap(api.GET("/api/uploads", { headers: headers() }));
}

export function getUpload(id: string) {
  return unwrap(api.GET("/api/uploads/{id}", { params: { path: { id } }, headers: headers() }));
}

export function createUpload(input: {
  saleNumber: string;
  year: number;
  centre: string;
  saleDate: string;
  broker: string;
  kind?: "PreAuctionCatalogue" | "PostAuctionSales";
  file: File;
}) {
  const body = new FormData();
  body.set("saleNumber", input.saleNumber);
  body.set("year", String(input.year));
  body.set("centre", input.centre);
  body.set("saleDate", input.saleDate);
  body.set("broker", input.broker);
  body.set("kind", input.kind ?? "PreAuctionCatalogue");
  body.set("file", input.file);
  return unwrap(
    api.POST("/api/uploads", {
      body: body as unknown as {
        saleNumber: string;
        year: number;
        centre: string;
        saleDate: string;
        broker: string;
        file: string;
      },
      bodySerializer: (payload) => payload as FormData,
      headers: headers(),
    }),
  );
}

export type PurchasedInvoiceSummary = {
  id: string;
  saleId?: string | null;
  saleNumber: string;
  year: number;
  centre: string;
  saleDate: string;
  broker: string;
  buyerCode: string;
  buyerName: string;
  contractNo: string;
  status: string;
  originalFileName: string;
  lotCount: number;
  netWeightKg: number;
  proceeds: number;
  vatAmount: number;
  payable: number;
  error?: string | null;
  createdAt: string;
};

export type PurchasedInvoiceLot = {
  id: string;
  broker: string;
  lotNumber: number;
  sellingMark: string;
  sellerName?: string;
  sellerVatNo?: string;
  invoiceNumber: string;
  grade: string;
  bags: number;
  netPerBagKg?: number | null;
  netWeightKg: number;
  soldPricePerKg: number;
  proceeds: number;
  vatAmount: number;
  proceedsWithVat: number;
};

export type CollectionBatchSummary = {
  id: string;
  saleId?: string | null;
  saleNumber: string;
  year: number;
  centre: string;
  saleDate: string;
  name: string;
  status: string;
  lotCount: number;
  bagCount: number;
  netWeightKg: number;
  createdAt: string;
  updatedAt?: string | null;
};

export type CollectionLot = {
  id: string;
  collectionBatchId: string;
  purchasedInvoiceLotId?: string | null;
  broker: string;
  lotNumber: number;
  sellingMark: string;
  sellerName: string;
  sellerVatNo: string;
  invoiceNumber: string;
  grade: string;
  bags: number;
  netPerBagKg?: number | null;
  netWeightKg: number;
  soldPricePerKg: number;
  proceeds: number;
  vatAmount: number;
  proceedsWithVat: number;
  warehouseOrBasis: string;
  buyerCode: string;
  buyerName: string;
  gardenMark: string;
  selectedAt: string;
  sampleBoxId?: string | null;
  boxNumber?: string | null;
};

export type CollectionBatchDetail = CollectionBatchSummary & {
  lots: CollectionLot[];
};

export type SampleBoxSummary = {
  id: string;
  collectionBatchId: string;
  boxNumber: string;
  status: string;
  lotCount: number;
  bagCount: number;
  netWeightKg: number;
  warehouseOrBasis: string;
  collectorName?: string | null;
  createdAt: string;
  printedAt?: string | null;
  printCount: number;
  receivedAt?: string | null;
  receivedBy?: string | null;
};

export type SampleBoxLot = {
  collectionLotId: string;
  broker: string;
  lotNumber: number;
  sellingMark: string;
  sellerName: string;
  invoiceNumber: string;
  grade: string;
  bags: number;
  netWeightKg: number;
  warehouseOrBasis: string;
  buyerCode: string;
  buyerName: string;
};

export type SampleBoxDetail = SampleBoxSummary & {
  remarks?: string | null;
  saleNumber: string;
  year: number;
  saleDate: string;
  centre: string;
  lots: SampleBoxLot[];
};

export type SampleBoxesResponse = {
  readyForBlending: boolean;
  boxes: SampleBoxSummary[];
};

export type PurchasedInvoiceWorkbench = {
  saleId?: string | null;
  saleNumber: string;
  year: number;
  saleDate: string;
  invoices: PurchasedInvoiceSummary[];
  lots: PurchasedInvoiceLot[];
};

export async function createPurchasedInvoice(input: {
  saleNumber: string;
  year: number;
  centre: string;
  saleDate: string;
  broker: string;
  file: File;
}): Promise<UploadAccepted> {
  const body = new FormData();
  body.set("saleNumber", input.saleNumber);
  body.set("year", String(input.year));
  body.set("centre", input.centre);
  body.set("saleDate", input.saleDate);
  body.set("broker", input.broker);
  body.set("file", input.file);
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/purchased-invoices`,
    { method: "POST", headers: headers(), body },
  );
  if (!response.ok) {
    let message = `The request failed (${response.status}).`;
    try {
      const payload = (await response.json()) as { errors?: string[] };
      if (payload.errors?.length) message = payload.errors.join(" ");
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await response.json()) as UploadAccepted;
}

export async function getPurchasedInvoiceWorkbench(saleNumber?: string, year?: number) {
  const params = new URLSearchParams();
  if (saleNumber) params.set("saleNumber", saleNumber);
  if (year) params.set("year", String(year));
  const q = params.toString();
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/purchased-invoices/workbench${q ? `?${q}` : ""}`,
    { headers: headers() },
  );
  if (!response.ok) throw new Error(`The request failed (${response.status}).`);
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text || text === "null") return null;
  return JSON.parse(text) as PurchasedInvoiceWorkbench;
}

export async function listPurchasedInvoices() {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/purchased-invoices`,
    { headers: headers() },
  );
  if (!response.ok) throw new Error(`The request failed (${response.status}).`);
  return (await response.json()) as PurchasedInvoiceSummary[];
}

export async function openPurchasedInvoicePdf(id: string) {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/purchased-invoices/${id}/pdf`,
    { headers: headers() },
  );
  if (!response.ok) throw new Error(`The request failed (${response.status}).`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Revoke later so the new tab can still load the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function listCollectionBatches() {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/collections`,
    { headers: headers() },
  );
  if (!response.ok) throw new Error(`The request failed (${response.status}).`);
  return (await response.json()) as CollectionBatchSummary[];
}

export async function listCollectedInvoiceLotIds(saleNumber: string, year: number) {
  const params = new URLSearchParams({
    saleNumber,
    year: String(year),
  });
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/collections/selected-invoice-lots?${params}`,
    { headers: headers() },
  );
  if (!response.ok) throw new Error(`The request failed (${response.status}).`);
  return (await response.json()) as string[];
}

export async function getCollectionBatch(id: string) {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/collections/${id}`,
    { headers: headers() },
  );
  if (!response.ok) throw new Error(`The request failed (${response.status}).`);
  return (await response.json()) as CollectionBatchDetail;
}

export async function selectCollectionLots(input: {
  saleNumber: string;
  year: number;
  name?: string;
  purchasedInvoiceLotIds: string[];
}) {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/collections/select`,
    {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    let message = `The request failed (${response.status}).`;
    try {
      const payload = (await response.json()) as { errors?: string[] };
      if (payload.errors?.length) message = payload.errors.join(" ");
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await response.json()) as CollectionBatchDetail;
}

async function readApiError(response: Response) {
  let message = `The request failed (${response.status}).`;
  try {
    const payload = (await response.json()) as { errors?: string[] };
    if (payload.errors?.length) message = payload.errors.join(" ");
  } catch {
    /* ignore */
  }
  return message;
}

export async function listSampleBoxes(batchId: string) {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/collections/${batchId}/boxes`,
    { headers: headers() },
  );
  if (!response.ok) throw new Error(`The request failed (${response.status}).`);
  return (await response.json()) as SampleBoxesResponse;
}

export async function getSampleBox(id: string) {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/collections/boxes/${id}`,
    { headers: headers() },
  );
  if (!response.ok) throw new Error(`The request failed (${response.status}).`);
  return (await response.json()) as SampleBoxDetail;
}

export async function generateSampleBoxes(input: {
  collectionBatchId: string;
  collectionLotIds: string[];
  mode: "shared" | "perLot";
  collectorName?: string;
  remarks?: string;
}) {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/collections/boxes/generate`,
    {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as SampleBoxDetail[];
}

export async function recordSampleBoxPrint(id: string) {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/collections/boxes/${id}/print`,
    { method: "POST", headers: headers() },
  );
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as SampleBoxDetail;
}

export async function markSampleBoxesReceived(input: {
  sampleBoxIds: string[];
  receivedBy?: string;
}) {
  const response = await fetch(
    `${(import.meta.env.VITE_API_BASE_URL ?? "").trim() || ""}/api/collections/boxes/received`,
    {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as SampleBoxSummary[];
}
