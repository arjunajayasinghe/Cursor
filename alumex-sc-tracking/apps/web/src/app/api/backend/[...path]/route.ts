import { requireIdentity, type VerifiedIdentity } from "../../../../../cursor/identity";
import { sampleForPath } from "@/lib/sample-data";
import {
  allowMethod,
  moduleKeyFromPath,
  normalizeProxyPath,
  roleFromIdentity,
} from "@/lib/server-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function backendBaseUrl(): string {
  return (process.env.API_BACKEND_URL || process.env.API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
}

/** Only same-origin host as configured backend may be followed on redirect. */
function isAllowedUpstreamRedirect(location: string, backend: string): boolean {
  try {
    const base = new URL(backend);
    const next = new URL(location, backend);
    if (next.protocol !== "http:" && next.protocol !== "https:") return false;
    return next.host === base.host;
  } catch {
    return false;
  }
}

/**
 * Server-side Nest proxy for published private/team apps.
 * - Requires Cursor identity
 * - Maps role from viewer email (ADMIN_EMAILS) — never from the browser
 * - Path normalized before RBAC and upstream URL (blocks .. traversal)
 * - Upstream fetch does not auto-follow redirects off the allowlisted host
 * - Does not forward client X-Demo-Role
 */
async function proxy(request: Request, pathSegments: string[]) {
  const identityOrRes = await requireIdentity(request);
  if (identityOrRes instanceof Response) return identityOrRes;
  const identity = identityOrRes as VerifiedIdentity;

  const normalized = normalizeProxyPath(pathSegments || []);
  if (!normalized.ok) {
    return Response.json(
      { message: normalized.reason },
      { status: 400, headers: { "cache-control": "private, no-store" } },
    );
  }
  const segments = normalized.segments;

  const role = roleFromIdentity(identity);
  const moduleKey = moduleKeyFromPath(segments);
  const method = request.method.toUpperCase();

  if (!allowMethod(role, method, moduleKey, segments)) {
    return Response.json(
      {
        message: `${role} cannot ${method} ${moduleKey || segments.join("/") || "this resource"}`,
        role,
        moduleKey,
      },
      { status: 403, headers: { "cache-control": "private, no-store" } },
    );
  }

  const backend = backendBaseUrl();
  const suffix = segments.map(encodeURIComponent).join("/");
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
    redirect: "manual",
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    let upstream = await fetch(target, init);
    // At most one same-host redirect; never leave the configured backend host.
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get("location");
      if (!location || !isAllowedUpstreamRedirect(location, backend)) {
        return Response.json(
          { message: "Upstream redirect blocked" },
          { status: 502, headers: { "cache-control": "private, no-store" } },
        );
      }
      const redirectUrl = new URL(location, backend).toString();
      const redirectInit: RequestInit = {
        method: method === "POST" && upstream.status === 303 ? "GET" : request.method,
        headers,
        cache: "no-store",
        redirect: "error",
      };
      if (redirectInit.method !== "GET" && redirectInit.method !== "HEAD" && init.body) {
        redirectInit.body = init.body;
      }
      upstream = await fetch(redirectUrl, redirectInit);
    }

    const body = await upstream.arrayBuffer();
    const out = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) out.set("content-type", upstreamType);
    out.set("cache-control", "private, no-store");
    return new Response(body, { status: upstream.status, headers: out });
  } catch {
    // Published host often has no Nest — serve sample GET payloads so menus/overview work.
    if (method === "GET" || method === "HEAD") {
      const sample = sampleForPath(segments);
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
