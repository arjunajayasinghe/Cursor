import { NextResponse } from "next/server";
import { getEffectiveAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignMasterBranchToCompany } from "@/lib/process-tree";

export async function GET() {
  const access = await getEffectiveAccess();
  if (!access?.isAetriaOperator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [companies, assignments] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    prisma.processAssignment.findMany({
      include: { masterNode: true, company: true },
      orderBy: { assignedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ companies, assignments });
}

export async function POST(req: Request) {
  const access = await getEffectiveAccess();
  if (!access?.isAetriaOperator) {
    return NextResponse.json({ error: "Only Aetria operators can assign processes" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const companyId = String(body?.companyId ?? "");
  const masterNodeId = String(body?.masterNodeId ?? "");
  if (!companyId || !masterNodeId) {
    return NextResponse.json({ error: "companyId and masterNodeId required" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const master = await prisma.processNode.findFirst({
    where: { id: masterNodeId, companyId: null },
  });
  if (!master) return NextResponse.json({ error: "Master node not found" }, { status: 404 });

  const result = await assignMasterBranchToCompany({
    companyId,
    masterNodeId,
    assignedById: access.session.id,
  });

  return NextResponse.json({ ok: true, ...result });
}
