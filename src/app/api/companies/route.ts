import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.isAetriaOperator) {
    const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ companies });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.id },
    include: { company: true },
  });
  return NextResponse.json({
    companies: memberships.map((m) => m.company),
  });
}
