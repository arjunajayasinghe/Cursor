import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AccessGuard } from "../permissions/access.guard";
import { CurrentRole, RequireAccess } from "../permissions/role.decorator";
import { PermissionsService, RoleContext } from "../permissions/permissions.service";
import { AnalyzePrImportDto, CreatePrDto, UpdatePrDto } from "./pr.dto";
import { PrService } from "./pr.service";

@Controller("pr")
@UseGuards(AccessGuard)
export class PrController {
  constructor(
    private readonly pr: PrService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  @RequireAccess("pr", 1)
  async list(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    const rows = await this.pr.list(q, status);
    return this.permissions.filterRows(role, "pr", rows as Array<{ recordId: string }>);
  }

  @Get("groups")
  @RequireAccess("pr", 1)
  async groups(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    const groups = await this.pr.groups(q, status);
    const ids = this.permissions.assignedIds(role, "pr");
    if (!ids) return groups;
    const set = new Set(ids);
    return groups
      .map((g: any) => ({
        ...g,
        lines: (g.lines || []).filter((l: any) => set.has(l.recordId)),
      }))
      .filter((g: any) => g.lines.length);
  }

  @Post("import/analyze")
  @RequireAccess("pr", 2)
  analyze(@Body() dto: AnalyzePrImportDto) {
    return this.pr.analyzeImport(dto.text);
  }

  @Post("import/commit")
  @RequireAccess("pr", 2)
  commit(@Body() dto: AnalyzePrImportDto) {
    return this.pr.commitImport(dto.text);
  }

  @Get(":id")
  @RequireAccess("pr", 1)
  async get(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    const row = await this.pr.get(id);
    this.permissions.assertRecord(role, "pr", String(row.recordId));
    return row;
  }

  @Post()
  @RequireAccess("pr", 2)
  create(@Body() dto: CreatePrDto) {
    return this.pr.create(dto);
  }

  @Patch(":id")
  @RequireAccess("pr", 2)
  async update(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() dto: UpdatePrDto) {
    const current = await this.pr.get(id);
    this.permissions.assertRecord(role, "pr", String(current.recordId));
    return this.pr.update(id, dto);
  }

  @Delete(":id")
  @RequireAccess("pr", 2)
  async remove(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    const current = await this.pr.get(id);
    this.permissions.assertRecord(role, "pr", String(current.recordId));
    return this.pr.remove(id);
  }
}
