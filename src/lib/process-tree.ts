import { prisma } from "./prisma";
import type { ProcessNode } from "@prisma/client";

export type TreeNode = ProcessNode & { children: TreeNode[] };

export function buildTree(nodes: ProcessNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const n of nodes) {
    const node = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    list.forEach((c) => sortRec(c.children));
  };
  sortRec(roots);
  return roots;
}

export async function loadProcessNodes(companyId: string | null) {
  return prisma.processNode.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function getDescendantIds(
  companyId: string | null,
  rootIds: string[]
): Promise<Set<string>> {
  if (rootIds.length === 0) return new Set();
  const all = await loadProcessNodes(companyId);
  const childrenMap = new Map<string, string[]>();
  for (const n of all) {
    if (!n.parentId) continue;
    const list = childrenMap.get(n.parentId) ?? [];
    list.push(n.id);
    childrenMap.set(n.parentId, list);
  }
  const result = new Set<string>();
  const stack = [...rootIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    const kids = childrenMap.get(id) ?? [];
    stack.push(...kids);
  }
  return result;
}

/** True if nodeId is within any of the scoped roots (inclusive). */
export async function isNodeInAreaScope(
  companyId: string,
  nodeId: string,
  scopeRootIds: string[]
): Promise<boolean> {
  if (scopeRootIds.includes(nodeId)) return true;
  const allowed = await getDescendantIds(companyId, scopeRootIds);
  return allowed.has(nodeId);
}

/**
 * Assign a master node (and its subtree) to a company by copying into the company tree.
 * Idempotent for already-copied nodes (matched by masterNodeId).
 */
export async function assignMasterBranchToCompany(opts: {
  companyId: string;
  masterNodeId: string;
  assignedById?: string;
  valueStreamId?: string | null;
}) {
  const { companyId, masterNodeId, assignedById } = opts;

  const masterNodes = await prisma.processNode.findMany({
    where: { companyId: null },
  });
  const byId = new Map(masterNodes.map((n) => [n.id, n]));
  if (!byId.has(masterNodeId)) {
    throw new Error("Master node not found");
  }

  const subtreeIds = await getDescendantIds(null, [masterNodeId]);
  const subtree = masterNodes
    .filter((n) => subtreeIds.has(n.id))
    .sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder);

  // Existing company copies keyed by masterNodeId
  const existing = await prisma.processNode.findMany({
    where: { companyId, masterNodeId: { in: [...subtreeIds] } },
  });
  const copyByMaster = new Map(existing.map((n) => [n.masterNodeId!, n.id]));

  // Remap master value streams → company value streams by code
  const [masterVs, companyVs] = await Promise.all([
    prisma.valueStream.findMany({ where: { companyId: null } }),
    prisma.valueStream.findMany({ where: { companyId } }),
  ]);
  const companyVsByCode = new Map(companyVs.map((v) => [v.code, v.id]));
  const masterVsById = new Map(masterVs.map((v) => [v.id, v]));

  async function resolveCompanyVsId(masterVsId: string | null): Promise<string | null> {
    if (opts.valueStreamId) return opts.valueStreamId;
    if (!masterVsId) return null;
    const master = masterVsById.get(masterVsId);
    if (!master) return null;
    const existingId = companyVsByCode.get(master.code);
    if (existingId) return existingId;
    const created = await prisma.valueStream.create({
      data: {
        companyId,
        code: master.code,
        name: master.name,
        sortOrder: master.sortOrder,
      },
    });
    companyVsByCode.set(created.code, created.id);
    return created.id;
  }

  await prisma.processAssignment.upsert({
    where: {
      companyId_masterNodeId: { companyId, masterNodeId },
    },
    create: { companyId, masterNodeId, assignedById },
    update: { assignedAt: new Date(), assignedById },
  });

  for (const master of subtree) {
    if (copyByMaster.has(master.id)) continue;

    let parentCompanyId: string | null = null;
    if (master.parentId && subtreeIds.has(master.parentId)) {
      parentCompanyId = copyByMaster.get(master.parentId) ?? null;
    } else if (master.parentId && copyByMaster.has(master.parentId)) {
      // Parent was assigned earlier as part of another branch
      parentCompanyId = copyByMaster.get(master.parentId)!;
    }

    const valueStreamId = await resolveCompanyVsId(master.valueStreamId);

    const created = await prisma.processNode.create({
      data: {
        companyId,
        parentId: parentCompanyId,
        code: master.code,
        name: master.name,
        description: master.description,
        level: master.level,
        sortOrder: master.sortOrder,
        masterNodeId: master.id,
        valueStreamId,
      },
    });
    copyByMaster.set(master.id, created.id);
  }

  return { copied: subtree.length, companyId, masterNodeId };
}

export type FlatUploadRow = {
  code: string;
  name: string;
  description?: string;
  parentCode?: string;
  valueStreamCode?: string;
};

/** Bulk upsert master processes from flat rows (CSV/Excel). Parent by code. */
export async function bulkUpsertMasterProcesses(rows: FlatUploadRow[]) {
  const valueStreams = await prisma.valueStream.findMany({ where: { companyId: null } });
  const vsByCode = new Map(valueStreams.map((v) => [v.code.toLowerCase(), v.id]));

  // Ensure parents exist before children by sorting on code depth
  const sorted = [...rows].sort((a, b) => {
    const da = a.code.split(".").length;
    const db = b.code.split(".").length;
    return da - db || a.code.localeCompare(b.code);
  });

  let created = 0;
  let updated = 0;

  for (const row of sorted) {
    const code = row.code.trim();
    const name = row.name.trim();
    if (!code || !name) continue;

    const parentCode = row.parentCode?.trim() || parentCodeFrom(code);
    let parentId: string | null = null;
    if (parentCode) {
      const parent = await prisma.processNode.findFirst({
        where: { companyId: null, code: parentCode },
      });
      parentId = parent?.id ?? null;
    }

    const level = code.split(".").length;
    const valueStreamId = row.valueStreamCode
      ? vsByCode.get(row.valueStreamCode.trim().toLowerCase()) ?? null
      : null;

    const existing = await prisma.processNode.findFirst({
      where: { companyId: null, code },
    });

    if (existing) {
      await prisma.processNode.update({
        where: { id: existing.id },
        data: {
          name,
          description: row.description?.trim() ?? existing.description,
          parentId,
          level,
          ...(valueStreamId ? { valueStreamId } : {}),
        },
      });
      updated++;
    } else {
      const siblings = await prisma.processNode.count({
        where: { companyId: null, parentId },
      });
      await prisma.processNode.create({
        data: {
          companyId: null,
          code,
          name,
          description: row.description?.trim() ?? "",
          parentId,
          level,
          sortOrder: siblings,
          valueStreamId,
        },
      });
      created++;
    }
  }

  return { created, updated, total: sorted.length };
}

function parentCodeFrom(code: string): string | null {
  const parts = code.split(".");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
}
