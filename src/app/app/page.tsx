import { redirect } from "next/navigation";
import { getEffectiveAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadProcessNodes } from "@/lib/process-tree";
import { ProcessWorkspace } from "@/components/ProcessWorkspace";

export default async function AppPage() {
  const access = await getEffectiveAccess();
  if (!access) redirect("/login");

  const nodes = await loadProcessNodes(access.companyId);
  const valueStreams = await prisma.valueStream.findMany({
    where: { companyId: access.companyId },
    orderBy: { sortOrder: "asc" },
  });

  if (access.isMasterView) {
    const [companies, assignments] = await Promise.all([
      prisma.company.findMany({ orderBy: { name: "asc" } }),
      prisma.processAssignment.findMany({
        include: { masterNode: true, company: true },
        orderBy: { assignedAt: "desc" },
        take: 20,
      }),
    ]);

    return (
      <ProcessWorkspace
        mode="master"
        nodes={nodes}
        valueStreams={valueStreams}
        companies={companies}
        assignments={assignments}
        canEdit={access.canEdit}
        canAdmin={access.canAdmin}
        canUpload
        canAssign
        canExport={false}
        areaScopeNodeIds={null}
      />
    );
  }

  const company = await prisma.company.findUnique({ where: { id: access.companyId! } });

  return (
    <ProcessWorkspace
      mode="company"
      nodes={nodes}
      valueStreams={valueStreams}
      canEdit={access.canEdit}
      canAdmin={access.canAdmin}
      canUpload={false}
      canAssign={false}
      canExport
      areaScopeNodeIds={access.areaScopeNodeIds}
      companyName={company?.name}
      companyId={access.companyId}
    />
  );
}
