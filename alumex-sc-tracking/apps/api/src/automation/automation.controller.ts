import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AccessGuard } from "../permissions/access.guard";
import { CurrentRole, RequireAccess } from "../permissions/role.decorator";
import { RoleContext } from "../permissions/permissions.service";
import { AutomationService } from "./automation.service";

@Controller("automation")
@UseGuards(AccessGuard)
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get("sla-rules")
  @RequireAccess("automation", 1)
  listSla() {
    return this.automation.listSlaRules();
  }

  @Patch("sla-rules/:key")
  @RequireAccess("automation", 2)
  updateSla(
    @Param("key") key: string,
    @Body() body: { targetValue?: number; unit?: string; active?: boolean; description?: string },
  ) {
    return this.automation.updateSlaRule(key, body);
  }

  @Get("notification-rules")
  @RequireAccess("automation", 1)
  listRules() {
    return this.automation.listNotificationRules();
  }

  @Patch("notification-rules/:triggerKey")
  @RequireAccess("automation", 2)
  updateRule(
    @Param("triggerKey") triggerKey: string,
    @Body()
    body: Partial<{
      active: boolean;
      recipientRoles: string;
      channels: string;
      dedupeHours: number;
      escalateAfterHours: number | null;
      action: string;
      severity: string;
      description: string;
    }>,
  ) {
    return this.automation.updateNotificationRule(decodeURIComponent(triggerKey), body);
  }

  @Get("events")
  @RequireAccess("automation", 1)
  events(
    @CurrentRole() role: RoleContext,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    return this.automation.listEvents({
      status,
      role: role.role,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get("outbox")
  @RequireAccess("automation", 1)
  outbox() {
    return this.automation.listOutbox();
  }

  @Get("exceptions")
  @RequireAccess("automation", 1)
  exceptions(@Query("status") status?: string) {
    return this.automation.listExceptions(status);
  }

  @Get("kpis")
  @RequireAccess("automation", 1)
  kpis() {
    return this.automation.kpisFromRules();
  }

  @Post("evaluate")
  @RequireAccess("automation", 1)
  evaluate(@CurrentRole() role: RoleContext) {
    // Allow view roles to trigger a refresh for demo; mutations of rules still need level 2
    return this.automation.evaluate(role.role);
  }

  @Post("events/:id/ack")
  @RequireAccess("automation", 1)
  ack(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.automation.acknowledge(id, role.role);
  }

  @Post("events/:id/resolve")
  @RequireAccess("automation", 1)
  resolve(@Param("id") id: string) {
    return this.automation.resolve(id);
  }
}
