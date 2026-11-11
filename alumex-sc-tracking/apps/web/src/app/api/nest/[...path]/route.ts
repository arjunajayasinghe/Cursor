import { sampleForPath } from "@/lib/sample-data";
import { normalizeProxyPath } from "@/lib/server-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Local-only Nest proxy so a laptop can use :3000 alone.
 * Hard-off in production: never proxies and never honors X-Demo-Role on the published host.
 * Locally requires LOCAL_NEST_PROXY=true (see .env.local.example).
 */
function localDemoEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.LOCAL_NEST_PROXY === "true";
}

function backendBaseUrl(): string {
  return (process.env.API_BACKEND_URL || process.env.API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
}

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

async function proxy(request: Request, pathSegments: string[]) {
  if (!localDemoEnabled()) {
    return Response.json({ message: "Local Nest proxy disabled" }, { status: 404 });
  }

  const normalized = normalizeProxyPath(pathSegments || []);
  if (!normalized.ok) {
    return Response.json({ message: normalized.reason }, { status: 400 });
  }
  const segments = normalized.segments;
  const method = request.method.toUpperCase();
  const backend = backendBaseUrl();
  const suffix = segments.map(encodeURIComponent).join("/");
  const incoming = new URL(request.url);
  const target = `${backend}/${suffix}${incoming.search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const demoRole = request.headers.get("x-demo-role") || "Management";
  headers.set("X-Demo-Role", demoRole);

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
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get("location");
      if (!location || !isAllowedUpstreamRedirect(location, backend)) {
        return Response.json({ message: "Upstream redirect blocked" }, { status: 502 });
      }
      const redirectUrl = new URL(location, backend).toString();
      upstream = await fetch(redirectUrl, {
        method: method === "POST" && upstream.status === 303 ? "GET" : request.method,
        headers,
        cache: "no-store",
        redirect: "error",
        body: method === "GET" || method === "HEAD" || (method === "POST" && upstream.status === 303) ? undefined : init.body,
      });
    }
    const body = await upstream.arrayBuffer();
    const out = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) out.set("content-type", upstreamType);
    out.set("cache-control", "private, no-store");
    return new Response(body, { status: upstream.status, headers: out });
  } catch {
    if (method === "GET" || method === "HEAD") {
      const sample = sampleForPath(segments);
      if (sample != null) {
        return Response.json(sample, {
          status: 200,
          headers: { "cache-control": "private, no-store", "x-alumex-mode": "sample" },
        });
      }
    }
    return Response.json(
      { message: "Nest API unreachable on :4000", mode: "offline" },
      { status: 502 },
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
