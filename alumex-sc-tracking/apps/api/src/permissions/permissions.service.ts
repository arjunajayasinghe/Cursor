import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ACCESS_LABELS,
  AccessLevel,
  DEFAULT_DEMO_ROLE,
  MODULE_LABELS,
  MODULE_OWNERS,
} from "./permissions.constants";

export type RoleContext = {
  role: string;
  roleId: string;
  assignedOnly: boolean;
  access: Record<string, AccessLevel>;
  assignments: Array<{ moduleKey: string; recordId: string; partyLabel?: string | null }>;
};

@Injectable()
export class PermissionsService implements OnModuleInit {
  private cache = new Map<string, RoleContext>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // PrismaService also connects on init; retry once if seed races first boot.
    try {
      await this.refreshCache();
    } catch {
      await new Promise((r) => setTimeout(r, 250));
      await this.refreshCache();
    }
  }

  async refreshCache() {
    const roles = await this.prisma.role.findMany({
      include: { permissions: true, assignments: true },
      orderBy: { sortOrder: "asc" },
    });
    this.cache.clear();
    for (const role of roles) {
      const access: Record<string, AccessLevel> = {};
      for (const p of role.permissions) {
        access[p.moduleKey] = Math.max(0, Math.min(2, p.level)) as AccessLevel;
      }
      this.cache.set(role.name, {
        role: role.name,
        roleId: role.id,
        assignedOnly: role.assignedOnly,
        access,
        assignments: role.assignments.map((a) => ({
          moduleKey: a.moduleKey,
          recordId: a.recordId,
          partyLabel: a.partyLabel,
        })),
      });
    }
  }

  listRoleNames() {
    return Array.from(this.cache.keys());
  }

  resolveRole(name?: string | null): RoleContext {
    const roleName = (name || DEFAULT_DEMO_ROLE).trim() || DEFAULT_DEMO_ROLE;
    const ctx = this.cache.get(roleName) || this.cache.get(DEFAULT_DEMO_ROLE);
    if (!ctx) {
      throw new ForbiddenException("No roles are configured. Re-seed the database.");
    }
    return ctx;
  }

  level(ctx: RoleContext, moduleKey: string): AccessLevel {
    if (ctx.role === "Administrator") return 2;
    return (ctx.access[moduleKey] ?? 0) as AccessLevel;
  }

  assert(ctx: RoleContext, moduleKey: string, min: AccessLevel) {
    const lvl = this.level(ctx, moduleKey);
    if (lvl < min) {
      throw new ForbiddenException(
        `${ctx.role} has ${ACCESS_LABELS[lvl].toLowerCase()} on ${MODULE_LABELS[moduleKey] || moduleKey}`,
      );
    }
  }

  assignedIds(ctx: RoleContext, moduleKey: string): string[] | null {
    if (!ctx.assignedOnly) return null;
    return ctx.assignments.filter((a) => a.moduleKey === moduleKey).map((a) => a.recordId);
  }

  assertRecord(ctx: RoleContext, moduleKey: string, recordId: string) {
    const ids = this.assignedIds(ctx, moduleKey);
    if (ids && !ids.includes(recordId)) {
      throw new ForbiddenException(
        `${ctx.role} is not assigned to ${MODULE_LABELS[moduleKey] || moduleKey} record ${recordId}`,
      );
    }
  }

  filterRows<T extends { recordId?: string | null }>(ctx: RoleContext, moduleKey: string, rows: T[]): T[] {
    const ids = this.assignedIds(ctx, moduleKey);
    if (!ids) return rows;
    const set = new Set(ids);
    return rows.filter((r) => r.recordId && set.has(r.recordId));
  }

  async me(roleName?: string | null) {
    await this.refreshCache();
    const ctx = this.resolveRole(roleName);
    return {
      role: ctx.role,
      assignedOnly: ctx.assignedOnly,
      access: ctx.access,
      accessLabels: ACCESS_LABELS,
      availableRoles: this.listRoleNames(),
      modules: Object.keys(MODULE_LABELS).map((key) => ({
        key,
        label: MODULE_LABELS[key],
        owner: MODULE_OWNERS[key],
        level: this.level(ctx, key),
      })),
      assignments: ctx.assignedOnly ? ctx.assignments : [],
      note: switchingNote(),
    };
  }

  async listRoles() {
    await this.refreshCache();
    const roles = await this.prisma.role.findMany({
      include: { permissions: true, _count: { select: { assignments: true } } },
      orderBy: { sortOrder: "asc" },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      assignedOnly: r.assignedOnly,
      assignmentCount: r._count.assignments,
      access: Object.fromEntries(r.permissions.map((p) => [p.moduleKey, p.level])),
    }));
  }

  async getRoleMatrix(roleName: string) {
    await this.refreshCache();
    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
      include: { permissions: true, assignments: true },
    });
    if (!role) throw new NotFoundException(`Role ${roleName} not found`);
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      assignedOnly: role.assignedOnly,
      modules: Object.keys(MODULE_LABELS).map((key) => ({
        key,
        label: MODULE_LABELS[key],
        owner: MODULE_OWNERS[key],
        level: role.permissions.find((p) => p.moduleKey === key)?.level ?? 0,
      })),
      assignments: role.assignments,
    };
  }

  async saveRolePermissions(
    actor: RoleContext,
    roleName: string,
    access: Record<string, number>,
  ) {
    this.assert(actor, "roles", 2);
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role ${roleName} not found`);
    if (role.name === "Administrator") {
      throw new ForbiddenException("Administrator permissions are fixed");
    }
    for (const [moduleKey, level] of Object.entries(access)) {
      const lvl = Math.max(0, Math.min(2, Number(level) || 0));
      await this.prisma.rolePermission.upsert({
        where: { roleId_moduleKey: { roleId: role.id, moduleKey } },
        create: { roleId: role.id, moduleKey, level: lvl },
        update: { level: lvl },
      });
    }
    await this.prisma.auditEvent.create({
      data: {
        moduleKey: "roles",
        recordId: role.name,
        actor: actor.role,
        action: "Updated permissions",
        detail: JSON.stringify(access),
      },
    });
    await this.refreshCache();
    return this.getRoleMatrix(roleName);
  }

  async listAssignments(actor: RoleContext, roleName?: string) {
    this.assert(actor, "roles", 1);
    const where = roleName ? { role: { name: roleName } } : {};
    return this.prisma.recordAssignment.findMany({
      where,
      include: { role: { select: { name: true, assignedOnly: true } } },
      orderBy: [{ moduleKey: "asc" }, { recordId: "asc" }],
    });
  }

  async assignRecord(
    actor: RoleContext,
    input: { roleName: string; moduleKey: string; recordId: string; partyLabel?: string; notes?: string },
  ) {
    this.assert(actor, "roles", 2);
    const role = await this.prisma.role.findUnique({ where: { name: input.roleName } });
    if (!role) throw new NotFoundException(`Role ${input.roleName} not found`);
    if (!role.assignedOnly) {
      throw new ForbiddenException("Assignments apply only to assigned-only external roles");
    }
    const row = await this.prisma.recordAssignment.upsert({
      where: {
        roleId_moduleKey_recordId: {
          roleId: role.id,
          moduleKey: input.moduleKey,
          recordId: input.recordId,
        },
      },
      create: {
        roleId: role.id,
        moduleKey: input.moduleKey,
        recordId: input.recordId,
        partyLabel: input.partyLabel,
        notes: input.notes,
      },
      update: {
        partyLabel: input.partyLabel,
        notes: input.notes,
      },
    });
    await this.refreshCache();
    return row;
  }
}

function switchingNote() {
  if (process.env.DEMO_ROLE_SWITCHING === "true") {
    return "Local demo: X-Demo-Role switching enabled (DEMO_ROLE_SWITCHING=true).";
  }
  return "Published/safe mode: role pinned to Management unless X-Admin-Demo-Secret matches. Cursor identity via Next proxy.";
}
