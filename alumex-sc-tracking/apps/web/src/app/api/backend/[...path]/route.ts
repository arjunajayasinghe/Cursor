import { requireIdentity } from "../../../../../cursor/identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-side Nest proxy. Role is pinned from Cursor identity — never from the browser. */
async function proxy(request: Request, pathSegments: string[]) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  // Published / non-demo: always pin read-only Management.
  // Local Nest may still honor DEMO_ROLE_SWITCHING when called directly (bypassing this proxy).
  const role = "Management";

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
  headers.set("X-Demo-Role", role);
  headers.set("X-Cursor-Viewer", identity.kind === "person" ? identity.name || identity.email || "viewer" : "service");

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
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
    return Response.json(
      {
        message: "Backend API unreachable from app host",
        hint: "Local demo: set NEXT_PUBLIC_DEMO_ROLE_SWITCHING=true and call Nest on :4000 directly.",
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
