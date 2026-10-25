import { redirect } from "next/navigation";
import { getEffectiveAccess, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const access = await getEffectiveAccess();
  if (!access) redirect("/login");

  let companies: { id: string; name: string; slug: string }[] = [];
  if (session.isAetriaOperator) {
    companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  } else {
    const memberships = await prisma.membership.findMany({
      where: { userId: session.id },
      include: { company: true },
    });
    companies = memberships.map((m) => m.company);
  }

  const activeCompany = access.companyId
    ? companies.find((c) => c.id === access.companyId) ??
      (await prisma.company.findUnique({ where: { id: access.companyId } }))
    : null;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col gap-6 bg-[var(--sidebar)] px-4 py-5 text-[var(--sidebar-fg)]">
        <div>
          <div className="font-[family-name:var(--font-display)] text-xl tracking-tight">
            Aetria
          </div>
          <div className="text-xs text-[var(--sidebar-muted)]">Process Mapping</div>
        </div>

        <WorkspaceSwitcher
          isAetriaOperator={session.isAetriaOperator}
          companies={companies}
          activeCompanyId={access.companyId}
        />

        <div className="text-xs leading-relaxed text-[var(--sidebar-muted)]">
          <div className="mb-1 font-medium text-[var(--sidebar-fg)]">{session.name}</div>
          <div>{session.email}</div>
          <div className="mt-2">
            {access.isMasterView
              ? "Role: Aetria operator · Master"
              : access.isAetriaOperator
                ? `Role: Aetria in ${activeCompany?.name ?? "company"}`
                : `Role: ${access.companyRole?.replace("_", " ") ?? "—"}`}
          </div>
        </div>

        <div className="mt-auto">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[var(--border)] bg-white/70 px-6 py-2 text-xs text-[var(--muted)] backdrop-blur">
          {access.isMasterView
            ? "Viewing Aetria Solution master library"
            : `Company workspace: ${activeCompany?.name ?? "Unknown"}`}
        </div>
        <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
