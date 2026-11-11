import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AccessGuard } from "../permissions/access.guard";
import { CurrentRole, RequireAccess } from "../permissions/role.decorator";
import { PermissionsService, RoleContext } from "../permissions/permissions.service";
import { CreatePoDto, UpdatePoDto } from "./po.dto";
import { PlatformService } from "../platform/platform.service";
import { PoService } from "./po.service";

@Controller("po")
@UseGuards(AccessGuard)
export class PoController {
  constructor(
    private readonly po: PoService,
    private readonly permissions: PermissionsService,
    private readonly platform: PlatformService,
  ) {}

  @Get()
  @RequireAccess("po", 1)
  async list(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    const rows = await this.po.list(q, status);
    return this.permissions.filterRows(role, "po", rows as Array<{ recordId: string }>);
  }

  /** Daily SAP Excel. View access is enough: only new and changed lines are written. */
  @Post("import/excel")
  @RequireAccess("po", 1)
  excel(
    @Body() body: { base64?: string; fileName?: string },
    @CurrentRole() role: RoleContext,
  ) {
    return this.platform.excelDelta("po", body, role.role);
  }

  @Get(":id")
  @RequireAccess("po", 1)
  async get(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    const row = await this.po.get(id);
    this.permissions.assertRecord(role, "po", String(row.recordId));
    return row;
  }

  @Post()
  @RequireAccess("po", 2)
  create(@Body() dto: CreatePoDto) {
    return this.po.create(dto);
  }

  @Patch(":id")
  @RequireAccess("po", 2)
  async update(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() dto: UpdatePoDto) {
    const current = await this.po.get(id);
    this.permissions.assertRecord(role, "po", String(current.recordId));
    return this.po.update(id, dto);
  }

  @Delete(":id")
  @RequireAccess("po", 2)
  async remove(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    const current = await this.po.get(id);
    this.permissions.assertRecord(role, "po", String(current.recordId));
    return this.po.remove(id);
  }
}
