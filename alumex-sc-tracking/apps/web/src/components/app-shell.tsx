"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Box,
  CheckSquare,
  FileText,
  LayoutGrid,
  Menu,
  Quote,
  Ship,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Shield,
  ChartColumn,
  Bell,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { SourceTag } from "@/components/ui/badge";
import { SOURCE_CODES } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const nav = [
  { href: "/", label: "Overview", icon: LayoutGrid, group: "Workspace", moduleKey: "overview" },
  { href: "/pr", label: "Purchase requisitions", icon: FileText, group: "Procurement", moduleKey: "pr" },
  { href: "/quotations", label: "Quotations", icon: Quote, group: "Procurement", moduleKey: "quotes" },
  { href: "/evaluation", label: "Evaluation & approval", icon: CheckSquare, group: "Procurement", moduleKey: "eval" },
  { href: "/po", label: "PO / PI", icon: ShoppingCart, group: "Procurement", moduleKey: "po" },
  { href: "/payments", label: "Payments", icon: Wallet, group: "Finance", moduleKey: "pay" },
  { href: "/confirmations", label: "Supplier confirmation", icon: CheckSquare, group: "Import", moduleKey: "confirm" },
  { href: "/shipping", label: "Shipping", icon: Box, group: "Import", moduleKey: "ship" },
  { href: "/vessel", label: "Vessel tracking", icon: Ship, group: "Import", moduleKey: "vessel" },
  { href: "/customs", label: "Customs clearance", icon: Shield, group: "Import", moduleKey: "customs" },
  { href: "/delivery", label: "Delivery & landed cost", icon: Truck, group: "Import", moduleKey: "delivery" },
  { href: "/grn", label: "GRN & closure", icon: Box, group: "Stores", moduleKey: "grn" },
  { href: "/reports", label: "Reports", icon: ChartColumn, group: "Insights", moduleKey: "reports" },
  { href: "/admin", label: "Role administration", icon: Users, group: "Admin", moduleKey: "roles" },
  { href: "/settings", label: "SLA & notifications", icon: Bell, group: "Admin", moduleKey: "automation" },
];

const titles: Record<string, string> = Object.fromEntries(nav.map((n) => [n.href, n.label]));

const ROLE_OPTIONS = [
  "Administrator",
  "Management",
  "Requester",
  "Procurement",
  "Finance",
  "Import Team",
  "Stores",
  "Technical 1",
  "Technical 2",
  "Supplier",
  "Clearing Agent",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, canView, me, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const crumb = titles[pathname] || "Module";
  const roles = me?.availableRoles?.length ? me.availableRoles : ROLE_OPTIONS;

  const visibleNav = useMemo(
    () =>
      nav.filter((item) => {
        if (item.moduleKey === "overview") {
          return role === "Administrator" || nav.some((n) => n.moduleKey !== "overview" && n.moduleKey !== "roles" && canView(n.moduleKey));
        }
        return canView(item.moduleKey);
      }),
    [canView, role],
  );

  useEffect(() => {
    if (loading) return;
    const current = nav.find((n) => n.href === pathname);
    if (!current) return;
    const allowed =
      current.moduleKey === "overview"
        ? role === "Administrator" || visibleNav.some((n) => n.href !== "/")
        : canView(current.moduleKey);
    if (!allowed) router.replace(visibleNav[0]?.href || "/");
  }, [pathname, loading, canView, role, router, visibleNav]);

  const groups = Array.from(new Set(visibleNav.map((n) => n.group)));
  const avatar =
    role === "Administrator"
      ? "AD"
      : role
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar)_minmax(0,1fr)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[228px] flex-col border-r border-line bg-white transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-[73px] items-center gap-3 border-b border-line px-5">
          <div className="grid h-[35px] w-[35px] place-items-center rounded-[9px] bg-[#075bb3] text-white shadow-[0_2px_4px_#0b57a62b]">
            <svg viewBox="0 0 24 24" className="h-[23px] w-[23px]" fill="none" aria-hidden>
              <path d="M3 19 11.5 4l8.5 15h-5.2l-3.3-6.4L8 19H3Z" fill="currentColor" />
              <path d="M16 9h3l3 5h-3l-3-5Z" fill="#a9d6ff" />
            </svg>
          </div>
          <div>
            <strong className="block text-[16px] leading-tight tracking-[0.2px]">ALUMEX</strong>
            <small className="mt-1 block text-[10px] tracking-[0.1px] text-muted">Supply Chain Connect</small>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-auto px-3 py-3" aria-label="Modules">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-1 mt-3 px-2.5 text-[10px] font-bold uppercase tracking-[1.02px] text-muted first:mt-0.5">
                {group}
              </div>
              {visibleNav
                .filter((n) => n.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] text-[#41546c]",
                        active && "bg-[#e8f2ff] font-bold text-[#075bb3] shadow-[inset_3px_0_#0973d2]",
                        !active && "hover:bg-[#eef4fa]",
                      )}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon className="h-[15px] w-[15px]" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="border-t border-line bg-white p-3">
          <Button variant="subtle" className="w-full justify-start" onClick={() => setSourcesOpen(true)}>
            ◫ &nbsp; Data source guide
          </Button>
        </div>
      </aside>

      {menuOpen ? (
        <button
          className="fixed inset-0 z-20 bg-[#17375251] lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-[65px] items-center justify-between gap-3 border-b border-line bg-white px-4 sm:px-8">
          <div className="flex items-center gap-2 text-xs text-sub">
            <Button variant="subtle" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <span className="hidden sm:inline">Workspace</span>
            <span className="hidden sm:inline">/</span>
            <strong className="text-ink">{crumb}</strong>
          </div>
          <div className="flex items-center gap-3">
            <span className="animate-pulse-soft rounded-[5px] border border-[#f2dfb7] bg-[#fff4db] px-2 py-1 text-[11px] font-semibold text-[#76521c]">
              DEMO DATA
            </span>
            {me?.assignedOnly ? (
              <span className="rounded-[5px] border border-[#d7e7fb] bg-[#eef6ff] px-2 py-1 text-[11px] font-semibold text-[#244c74]">
                Assigned records only
              </span>
            ) : null}
            <div className="flex items-center gap-2">
              <span className="grid h-[29px] min-w-[29px] place-items-center rounded-full bg-[#e4effe] text-[11px] font-bold text-[#0c57a2]">
                {avatar}
              </span>
              <select
                aria-label="Demo role"
                className="max-w-[155px] border-0 bg-white px-1 py-1 text-xs font-semibold text-[#213a55]"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1520px] px-4 py-6 sm:px-8">{children}</main>
      </div>

      <Drawer
        open={sourcesOpen}
        onOpenChange={setSourcesOpen}
        eyebrow="Phase 1 · Manual capture"
        title="Data source guide"
        footer={<Button onClick={() => setSourcesOpen(false)}>Close</Button>}
      >
        <div className="mb-4 flex gap-2 rounded-md border border-[#d7e7fb] bg-[#eef6ff] p-3 text-xs text-[#244c74]">
          Field tags identify where data originates and how it can be sourced later. Access is enforced by the API
          using the demo role selector (X-Demo-Role).
        </div>
        <div className="space-y-2">
          {Object.entries(SOURCE_CODES).map(([code, [name, desc]]) => (
            <div key={code} className="flex items-start justify-between gap-3 rounded-md border border-line p-3">
              <div>
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <SourceTag code={code} /> {name}
                </div>
                <p className="text-xs text-sub">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
