import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AccessGuard } from "../permissions/access.guard";
import { CurrentRole, RequireAccess } from "../permissions/role.decorator";
import { RoleContext } from "../permissions/permissions.service";
import { PlatformService } from "./platform.service";

@Controller("platform")
@UseGuards(AccessGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  // Audit
  @Get("audit")
  @RequireAccess("reports", 1)
  audit(
    @Query("moduleKey") moduleKey?: string,
    @Query("recordId") recordId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.platform.listAudit(moduleKey, recordId, limit ? Number(limit) : 100);
  }

  @Get("audit/:moduleKey/:recordId")
  history(@Param("moduleKey") moduleKey: string, @Param("recordId") recordId: string) {
    return this.platform.listAudit(moduleKey, decodeURIComponent(recordId), 100);
  }

  // Workflow
  @Get("workflow/machines")
  @RequireAccess("reports", 1)
  machines() {
    return this.platform.listMachines();
  }

  @Get("workflow/:moduleKey/:recordId")
  workflowState(@Param("moduleKey") moduleKey: string, @Param("recordId") recordId: string) {
    return this.platform.allowedTransitions(moduleKey, decodeURIComponent(recordId));
  }

  @Get("workflow/:moduleKey/:recordId/history")
  workflowHistory(@Param("moduleKey") moduleKey: string, @Param("recordId") recordId: string) {
    return this.platform.listWorkflowHistory(moduleKey, decodeURIComponent(recordId));
  }

  @Post("workflow/:moduleKey/:recordId/transition")
  transition(
    @CurrentRole() role: RoleContext,
    @Param("moduleKey") moduleKey: string,
    @Param("recordId") recordId: string,
    @Body() body: { toStatus: string; note?: string },
  ) {
    return this.platform.transition(
      moduleKey,
      decodeURIComponent(recordId),
      body.toStatus,
      role.role,
      body.note,
    );
  }

  // Masters
  @Get("masters")
  @RequireAccess("masters", 1)
  masters(@Query("category") category?: string) {
    return this.platform.listMasters(category);
  }

  @Put("masters")
  @RequireAccess("masters", 2)
  upsertMaster(
    @Body()
    body: {
      category: string;
      code: string;
      name: string;
      extra?: string;
      active?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.platform.upsertMaster(body);
  }

  @Delete("masters/:id")
  @RequireAccess("masters", 2)
  deleteMaster(@Param("id") id: string) {
    return this.platform.deleteMaster(id);
  }

  // Exceptions (dedicated)
  @Get("exceptions")
  @RequireAccess("automation", 1)
  exceptions(@Query("status") status?: string) {
    return this.platform.listExceptions(status);
  }

  @Patch("exceptions/:id")
  @RequireAccess("automation", 2)
  patchException(
    @CurrentRole() role: RoleContext,
    @Param("id") id: string,
    @Body() body: { status?: string; authorizedBy?: string; detail?: string },
  ) {
    return this.platform.updateException(id, body, role.role);
  }

  // Integrations
  @Get("integrations")
  @RequireAccess("integrations", 1)
  integrations() {
    return this.platform.listIntegrations();
  }

  @Patch("integrations/:key")
  @RequireAccess("integrations", 2)
  patchIntegration(
    @Param("key") key: string,
    @Body()
    body: Partial<{
      status: string;
      channel: string;
      description: string;
      fieldPriority: Record<string, string>;
      notes: string;
    }>,
  ) {
    return this.platform.updateIntegration(key, body);
  }

  @Post("integrations/:key/preview")
  @RequireAccess("integrations", 1)
  preview(@Param("key") key: string, @Body() body: { text: string }) {
    return this.platform.previewSapImport(key, body.text || "");
  }

  // Monitoring
  @Get("monitoring")
  @RequireAccess("reports", 1)
  monitoring(
    @Query("prNo") prNo?: string,
    @Query("poNo") poNo?: string,
    @Query("importNo") importNo?: string,
    @Query("supplier") supplier?: string,
    @Query("plant") plant?: string,
    @Query("material") material?: string,
    @Query("department") department?: string,
    @Query("stage") stage?: string,
    @Query("status") status?: string,
    @Query("overdue") overdue?: string,
    @Query("vessel") vessel?: string,
  ) {
    return this.platform.monitoring({
      prNo,
      poNo,
      importNo,
      supplier,
      plant,
      material,
      department,
      stage,
      status,
      overdue,
      vessel,
    });
  }

  @Post("validate/duplicate")
  @RequireAccess("reports", 1)
  duplicate(@Body() body: { moduleKey: string; fields: Record<string, string> }) {
    return this.platform.checkDuplicate(body.moduleKey, body.fields || {});
  }
}
