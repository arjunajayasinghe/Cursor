import { NextResponse } from "next/server";
import { getSession, setActiveCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const companyId = body?.companyId === null || body?.companyId === "" ? null : String(body?.companyId ?? "");

  if (companyId === null) {
    if (!session.isAetriaOperator) {
      return NextResponse.json({ error: "Only Aetria operators can open the master view" }, { status: 403 });
    }
    await setActiveCompany(null);
    return NextResponse.json({ ok: true, activeCompanyId: null });
  }

  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (!session.isAetriaOperator) {
    const membership = await prisma.membership.findUnique({
      where: { userId_companyId: { userId: session.id, companyId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "No access to this company" }, { status: 403 });
    }
  }

  await setActiveCompany(companyId);
  return NextResponse.json({ ok: true, activeCompanyId: companyId });
}
