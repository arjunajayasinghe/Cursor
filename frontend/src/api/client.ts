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
  baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
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
