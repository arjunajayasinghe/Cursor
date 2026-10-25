import { NextResponse } from "next/server";
import { getEffectiveAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportCompanyByValueStream } from "@/lib/export-stub";

export async function GET(req: Request) {
  const access = await getEffectiveAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") ?? access.companyId;

  if (!companyId) {
    return NextResponse.json(
      { error: "Export requires a company workspace (or ?companyId=)" },
      { status: 400 }
    );
  }

  if (!access.isAetriaOperator && companyId !== access.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const buffer = await exportCompanyByValueStream(companyId);
  const filename = `${company.slug}-processes-by-value-stream-STUB.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Export-Stub": "true",
    },
  });
}
