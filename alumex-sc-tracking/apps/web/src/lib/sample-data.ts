import type { OverviewData, PermissionsMe } from "@/lib/api";
import { PUBLISHED_DEFAULT_ROLE } from "@/lib/server-role";

const MODULES = [
  "pr",
  "quotes",
  "eval",
  "po",
  "pay",
  "confirm",
  "ship",
  "vessel",
  "customs",
  "delivery",
  "grn",
  "reports",
  "automation",
  "masters",
  "integrations",
] as const;

/** Read-only Management matrix used when Nest is unreachable (published sample mode). */
export function managementFallbackMe(): PermissionsMe {
  const access: Record<string, number> = Object.fromEntries(MODULES.map((k) => [k, 1]));
  access.roles = 0;
  return {
    role: PUBLISHED_DEFAULT_ROLE,
    assignedOnly: false,
    access,
    accessLabels: ["No access", "View only", "Create and edit"],
    availableRoles: [PUBLISHED_DEFAULT_ROLE],
    modules: MODULES.map((key) => ({
      key,
      label: key,
      owner: "Demo",
      level: 1,
    })),
    assignments: [],
    note: "Sample mode — backend unreachable; menus use Management view matrix",
  };
}

export function sampleOverview(): OverviewData {
  const pipeline = [
    { key: "pr", label: "Purchase requisitions", count: 8 },
    { key: "quotes", label: "Quotations", count: 14 },
    { key: "eval", label: "Evaluation", count: 5 },
    { key: "po", label: "PO / PI", count: 6 },
    { key: "ship", label: "Shipping", count: 3 },
    { key: "vessel", label: "Vessel tracking", count: 2 },
    { key: "grn", label: "GRN & closure", count: 4 },
  ];
  const max = Math.max(...pipeline.map((p) => p.count), 1);
  return {
    kpis: [
      { label: "Open cases", value: 12, detail: "Sample demo data", tone: "blue", icon: "grid" },
      { label: "Exceptions", value: 3, detail: "Sample register", tone: "amber", icon: "alert" },
      { label: "In transit", value: 2, detail: "Sample vessels", tone: "blue", icon: "ship" },
      { label: "Closed files", value: 4, detail: "Sample GRNs", tone: "green", icon: "check" },
    ],
    kpiDetail: [],
    pipeline: pipeline.map((p) => ({ ...p, pct: Math.round((p.count / max) * 100) })),
    attention: [
      {
        module: "customs",
        id: "CUS-DEMO",
        title: "Sample clearance watch",
        subtitle: "Demo exception — connect Nest API for live alerts",
        tone: "amber",
        href: "/customs",
        triggerKey: "sample",
      },
    ],
    alertSummary: [{ triggerKey: "sample", count: 3 }],
    recentPr: [
      {
        id: "s1",
        prNo: "100009901",
        line: "00010",
        material: "Demo billet 6063",
        status: "Released",
        plant: "1100",
      },
      {
        id: "s2",
        prNo: "100009902",
        line: "00010",
        material: "Demo gasket strip",
        status: "Pending release",
        plant: "1200",
      },
    ],
    recentPo: [
      {
        id: "p1",
        poNo: "450009901",
        supplier: "Gulf Alloy Trading",
        material: "Demo billet 6063",
        status: "Released",
        piNo: "PI-DEMO",
      },
    ],
  };
}

export function sampleForPath(segments: string[]): unknown | null {
  const root = segments[0] || "";
  if (root === "permissions" && segments[1] === "me") return managementFallbackMe();
  if (root === "health") return { ok: true, service: "alumex-sample", mode: "sample" };
  if (root === "overview") return sampleOverview();
  if (root === "pr" && segments[1] === "groups") {
    return [
      {
        prNo: "100009901",
        lineCount: 1,
        requester: "Demo requester",
        department: "Manufacturing",
        plant: "1100 · Sapugaskanda",
        date: "2026-10-03",
        buyer: "A. Jayasinghe",
        priority: "High",
        statuses: ["Released"],
        material: "Demo billet 6063",
        quantity: 25,
        lines: [
          {
            id: "s1",
            recordId: "PR-DEMO-1",
            prNo: "100009901",
            line: "00010",
            date: "2026-10-03",
            requester: "Demo requester",
            department: "Manufacturing",
            plant: "1100 · Sapugaskanda",
            materialCode: "ALX-301",
            material: "Demo billet 6063",
            quantity: 25,
            uom: "MT",
            need: "2026-11-19",
            buyer: "A. Jayasinghe",
            priority: "High",
            status: "Released",
          },
        ],
      },
      {
        prNo: "100009902",
        lineCount: 1,
        requester: "Demo requester",
        department: "Manufacturing",
        plant: "1200 · Ekala",
        date: "2026-10-08",
        buyer: "A. Jayasinghe",
        priority: "Normal",
        statuses: ["Pending release"],
        material: "Demo gasket strip",
        quantity: 40,
        lines: [
          {
            id: "s2",
            recordId: "PR-DEMO-2",
            prNo: "100009902",
            line: "00010",
            date: "2026-10-08",
            requester: "Demo requester",
            department: "Manufacturing",
            plant: "1200 · Ekala",
            materialCode: "GSK-014",
            material: "Demo gasket strip",
            quantity: 40,
            uom: "EA",
            need: "2026-11-30",
            buyer: "A. Jayasinghe",
            priority: "Normal",
            status: "Pending release",
          },
        ],
      },
    ];
  }
  if (["pr", "po", "quotations", "quotes", "evaluation", "eval", "payments", "pay"].includes(root)) {
    return [];
  }
  if (
    [
      "confirmations",
      "shipping",
      "vessel-tracking",
      "customs",
      "delivery",
      "grn",
      "automation",
      "documents",
    ].includes(root)
  ) {
    return [];
  }
  if (root === "workbench") {
    if (segments[1] === "dashboard") {
      return {
        poCount: 1,
        withPending: 1,
        withSplit: 1,
        withShortShip: 1,
        openShipments: 2,
        attention: [{ poNo: "4500012987", coverPoNo: "COV-4500012987", flags: ["split", "multi-mode"], pendingQty: 0, modes: ["Sea", "Air"] }],
      };
    }
    if (segments[1] === "pos" && !segments[2]) {
      return [
        {
          poNo: "4500012987",
          coverPoNo: "COV-4500012987",
          supplier: "Gulf Alloy Trading",
          importNo: "IMP-256",
          currency: "USD",
          status: "Sent to supplier",
          lineCount: 1,
          orderQty: 160,
          allocatedQty: 160,
          shippedQty: 158,
          shortQty: 2,
          pendingQty: 0,
          modes: ["Sea", "Air"],
          shipmentCount: 2,
          flags: ["split", "multi-mode", "short-ship"],
        },
      ];
    }
    return { header: { poNo: segments[2] || "4500012987", status: [] }, lines: [], dashboard: { lineCount: 0, orderQty: 0, pendingQty: 0, allocatedQty: 0, shortQty: 0, shipmentCount: 0, modes: [], attention: [] } };
  }
  if (root === "reports") return { type: "pipeline", headers: [], rows: [], counts: [] };
  if (root === "platform") {
    const sub = segments[1];
    if (sub === "masters")
      return [{ id: "1", category: "plant", code: "1100", name: "Sapugaskanda", active: true, sortOrder: 10 }];
    if (sub === "exceptions" || sub === "integrations" || sub === "audit") return [];
    if (sub === "sync-jobs")
      return [
        {
          id: "sample-sync-pr",
          integrationKey: "sap_pr_api",
          name: "PR released report · every 6h",
          schedule: "0 */6 * * *",
          enabled: true,
          status: "idle",
          sapClient: "100",
          runCount: 0,
          lastResult: "Sample mode — Nest offline",
        },
      ];
    if (sub === "mismatches")
      return [
        {
          id: "sample-mm-1",
          moduleKey: "pr",
          recordId: "PR-DEMO-1",
          field: "quantity",
          existingValue: "25",
          incomingValue: "30",
          preferredSource: "S",
          action: "exception",
          status: "open",
          detail: "Sample mismatch (Nest offline)",
        },
      ];
    if (sub === "monitoring")
      return {
        type: "monitoring",
        headers: ["prNo", "material", "stage"],
        rows: [],
        counts: { total: 0, overdue: 0, byStage: [] },
      };
    if (sub === "workflow") return segments.includes("machines") ? [] : { current: "—", next: [] };
    return [];
  }
  if (root === "permissions" && segments[1] === "roles") return [{ name: "Management", description: "Read-only" }];
  return null;
}
