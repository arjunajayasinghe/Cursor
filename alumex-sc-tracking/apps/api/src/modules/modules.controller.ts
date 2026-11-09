import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AccessGuard } from "../permissions/access.guard";
import { CurrentRole, RequireAccess } from "../permissions/role.decorator";
import { PermissionsService, RoleContext } from "../permissions/permissions.service";
import { ModuleKey } from "./module-defs";
import { ModulesService } from "./modules.service";

@Controller()
@UseGuards(AccessGuard)
export class ModulesController {
  constructor(
    private readonly modules: ModulesService,
    private readonly permissions: PermissionsService,
  ) {}

  private async listSecured(role: RoleContext, key: ModuleKey, q?: string, status?: string) {
    this.permissions.assert(role, key, 1);
    const rows = await this.modules.list(key, q, status);
    return this.permissions.filterRows(role, key, rows as Array<{ recordId: string }>);
  }

  private async getSecured(role: RoleContext, key: ModuleKey, id: string) {
    this.permissions.assert(role, key, 1);
    const row = await this.modules.get(key, id);
    this.permissions.assertRecord(role, key, String(row.recordId));
    return row;
  }

  private async createSecured(role: RoleContext, key: ModuleKey, body: Record<string, unknown>) {
    this.permissions.assert(role, key, 2);
    return this.modules.create(key, body || {});
  }

  private async updateSecured(
    role: RoleContext,
    key: ModuleKey,
    id: string,
    body: Record<string, unknown>,
  ) {
    this.permissions.assert(role, key, 2);
    const current = await this.modules.get(key, id);
    this.permissions.assertRecord(role, key, String(current.recordId));
    return this.modules.update(key, id, body || {});
  }

  private async removeSecured(role: RoleContext, key: ModuleKey, id: string) {
    this.permissions.assert(role, key, 2);
    const current = await this.modules.get(key, id);
    this.permissions.assertRecord(role, key, String(current.recordId));
    return this.modules.remove(key, id);
  }

  @Get("modules")
  listDefs(@CurrentRole() role: RoleContext) {
    return this.modules.listDefs().filter((m) => this.permissions.level(role, m.key) > 0);
  }

  @Get("reports")
  @RequireAccess("reports", 1)
  reports(@Query("type") type?: string) {
    return this.modules.reports(type || "pipeline");
  }

  @Get("quotes")
  listQuotes(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    return this.listSecured(role, "quotes", q, status);
  }
  @Get("quotes/:id")
  getQuote(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.getSecured(role, "quotes", id);
  }
  @Post("quotes")
  createQuote(@CurrentRole() role: RoleContext, @Body() body: Record<string, unknown>) {
    return this.createSecured(role, "quotes", body);
  }
  @Patch("quotes/:id")
  updateQuote(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateSecured(role, "quotes", id, body);
  }
  @Delete("quotes/:id")
  removeQuote(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.removeSecured(role, "quotes", id);
  }

  @Get("eval")
  listEval(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    return this.listSecured(role, "eval", q, status);
  }
  @Get("eval/:id")
  getEval(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.getSecured(role, "eval", id);
  }
  @Post("eval")
  createEval(@CurrentRole() role: RoleContext, @Body() body: Record<string, unknown>) {
    return this.createSecured(role, "eval", body);
  }
  @Patch("eval/:id")
  updateEval(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateSecured(role, "eval", id, body);
  }
  @Delete("eval/:id")
  removeEval(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.removeSecured(role, "eval", id);
  }

  @Get("pay")
  listPay(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    return this.listSecured(role, "pay", q, status);
  }
  @Get("pay/:id")
  getPay(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.getSecured(role, "pay", id);
  }
  @Post("pay")
  createPay(@CurrentRole() role: RoleContext, @Body() body: Record<string, unknown>) {
    return this.createSecured(role, "pay", body);
  }
  @Patch("pay/:id")
  updatePay(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateSecured(role, "pay", id, body);
  }
  @Delete("pay/:id")
  removePay(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.removeSecured(role, "pay", id);
  }

  @Get("confirm")
  listConfirm(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    return this.listSecured(role, "confirm", q, status);
  }
  @Get("confirm/:id")
  getConfirm(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.getSecured(role, "confirm", id);
  }
  @Post("confirm")
  createConfirm(@CurrentRole() role: RoleContext, @Body() body: Record<string, unknown>) {
    return this.createSecured(role, "confirm", body);
  }
  @Patch("confirm/:id")
  updateConfirm(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateSecured(role, "confirm", id, body);
  }
  @Delete("confirm/:id")
  removeConfirm(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.removeSecured(role, "confirm", id);
  }

  @Get("ship")
  listShip(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    return this.listSecured(role, "ship", q, status);
  }
  @Get("ship/:id")
  getShip(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.getSecured(role, "ship", id);
  }
  @Post("ship")
  createShip(@CurrentRole() role: RoleContext, @Body() body: Record<string, unknown>) {
    return this.createSecured(role, "ship", body);
  }
  @Patch("ship/:id")
  updateShip(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateSecured(role, "ship", id, body);
  }
  @Delete("ship/:id")
  removeShip(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.removeSecured(role, "ship", id);
  }

  @Get("vessel")
  listVessel(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    return this.listSecured(role, "vessel", q, status);
  }
  @Get("vessel/:id")
  getVessel(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.getSecured(role, "vessel", id);
  }
  @Post("vessel")
  createVessel(@CurrentRole() role: RoleContext, @Body() body: Record<string, unknown>) {
    return this.createSecured(role, "vessel", body);
  }
  @Patch("vessel/:id")
  updateVessel(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateSecured(role, "vessel", id, body);
  }
  @Delete("vessel/:id")
  removeVessel(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.removeSecured(role, "vessel", id);
  }

  @Get("customs")
  listCustoms(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    return this.listSecured(role, "customs", q, status);
  }
  @Get("customs/:id")
  getCustoms(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.getSecured(role, "customs", id);
  }
  @Post("customs")
  createCustoms(@CurrentRole() role: RoleContext, @Body() body: Record<string, unknown>) {
    return this.createSecured(role, "customs", body);
  }
  @Patch("customs/:id")
  updateCustoms(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateSecured(role, "customs", id, body);
  }
  @Delete("customs/:id")
  removeCustoms(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.removeSecured(role, "customs", id);
  }

  @Get("delivery")
  listDelivery(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    return this.listSecured(role, "delivery", q, status);
  }
  @Get("delivery/:id")
  getDelivery(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.getSecured(role, "delivery", id);
  }
  @Post("delivery")
  createDelivery(@CurrentRole() role: RoleContext, @Body() body: Record<string, unknown>) {
    return this.createSecured(role, "delivery", body);
  }
  @Patch("delivery/:id")
  updateDelivery(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateSecured(role, "delivery", id, body);
  }
  @Delete("delivery/:id")
  removeDelivery(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.removeSecured(role, "delivery", id);
  }

  @Get("grn")
  listGrn(@CurrentRole() role: RoleContext, @Query("q") q?: string, @Query("status") status?: string) {
    return this.listSecured(role, "grn", q, status);
  }
  @Get("grn/:id")
  getGrn(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.getSecured(role, "grn", id);
  }
  @Post("grn")
  createGrn(@CurrentRole() role: RoleContext, @Body() body: Record<string, unknown>) {
    return this.createSecured(role, "grn", body);
  }
  @Patch("grn/:id")
  updateGrn(@CurrentRole() role: RoleContext, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.updateSecured(role, "grn", id, body);
  }
  @Delete("grn/:id")
  removeGrn(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.removeSecured(role, "grn", id);
  }
}
