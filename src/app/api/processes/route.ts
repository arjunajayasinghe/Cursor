import { NextResponse } from "next/server";
import { getEffectiveAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isNodeInAreaScope, loadProcessNodes } from "@/lib/process-tree";

export async function GET() {
  const access = await getEffectiveAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nodes = await loadProcessNodes(access.companyId);
  return NextResponse.json({ nodes, companyId: access.companyId });
}

export async function PATCH(req: Request) {
  const access = await getEffectiveAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canEdit) {
    return NextResponse.json({ error: "Read-only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const node = await prisma.processNode.findUnique({ where: { id } });
  if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Scope check: must belong to current workspace
  const expectedCompany = access.companyId;
  if (node.companyId !== expectedCompany) {
    return NextResponse.json({ error: "Wrong workspace" }, { status: 403 });
  }

  if (access.areaScopeNodeIds) {
    const ok = await isNodeInAreaScope(access.companyId!, id, access.areaScopeNodeIds);
    if (!ok) {
      return NextResponse.json({ error: "Outside your area scope" }, { status: 403 });
    }
  }

  // Master view: only operators (already gated). Company: admins can rename/hide more freely.
  const data: {
    name?: string;
    description?: string;
    isHidden?: boolean;
    valueStreamId?: string | null;
  } = {};

  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.isHidden === "boolean") {
    if (!access.canAdmin && !access.isAetriaOperator) {
      return NextResponse.json({ error: "Only admins can hide processes" }, { status: 403 });
    }
    data.isHidden = body.isHidden;
  }
  if ("valueStreamId" in (body ?? {})) {
    data.valueStreamId = body.valueStreamId ? String(body.valueStreamId) : null;
  }

  const updated = await prisma.processNode.update({ where: { id }, data });
  return NextResponse.json({ node: updated });
}
