import { requireIdentity, type VerifiedIdentity } from "../../../../../cursor/identity";
import { sampleForPath } from "@/lib/sample-data";
import {
  allowMethod,
  moduleKeyFromPath,
  roleFromIdentity,
} from "@/lib/server-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-side Nest proxy for published private/team apps.
 * - Requires Cursor identity
 * - Maps role from viewer email (ADMIN_EMAILS) — never from the browser
 * - GET for viewers with module view; mutations only when role has create/edit
 * - Does not forward client X-Demo-Role
 */
async function proxy(request: Request, pathSegments: string[]) {
  const identityOrRes = await requireIdentity(request);
  if (identityOrRes instanceof Response) return identityOrRes;
  const identity = identityOrRes as VerifiedIdentity;

  const role = roleFromIdentity(identity);
  const moduleKey = moduleKeyFromPath(pathSegments);
  const method = request.method.toUpperCase();

  if (!allowMethod(role, method, moduleKey)) {
    return Response.json(
      {
        message: `${role} cannot ${method} ${moduleKey || pathSegments.join("/") || "this resource"}`,
        role,
        moduleKey,
      },
      { status: 403, headers: { "cache-control": "private, no-store" } },
    );
  }

  const backend = (process.env.API_BACKEND_URL || process.env.API_URL || "http://127.0.0.1:4000").replace(
    /\/$/,
    "",
  );
  const suffix = pathSegments.map(encodeURIComponent).join("/");
  const incoming = new URL(request.url);
  const target = `${backend}/${suffix}${incoming.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  // Server-chosen role only — ignore any client demo-role header.
  headers.set("X-Demo-Role", role);
  const label =
    identity.kind === "person" ? identity.name || identity.email || "viewer" : identity.name || "service";
  headers.set("X-Cursor-Viewer", label);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const out = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) out.set("content-type", upstreamType);
    out.set("cache-control", "private, no-store");
    return new Response(body, { status: upstream.status, headers: out });
  } catch {
    // Published host often has no Nest — serve sample GET payloads so menus/overview work.
    if (method === "GET" || method === "HEAD") {
      const sample = sampleForPath(pathSegments);
      if (sample != null) {
        return Response.json(sample, {
          status: 200,
          headers: {
            "cache-control": "private, no-store",
            "x-alumex-mode": "sample",
          },
        });
      }
    }
    return Response.json(
      {
        message: "Backend API unreachable from app host",
        hint: "Add API_BACKEND_URL secret, or use localhost with Nest on :4000.",
        mode: "offline",
      },
      { status: 502, headers: { "cache-control": "private, no-store" } },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path || []);
}
export async function POST(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path || []);
}
export async function PUT(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path || []);
}
export async function PATCH(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path || []);
}
export async function DELETE(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path || []);
}
