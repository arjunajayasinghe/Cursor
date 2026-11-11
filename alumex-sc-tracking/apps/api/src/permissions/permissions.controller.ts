import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AccessGuard } from "./access.guard";
import { CurrentRole, RequireAccess } from "./role.decorator";
import { PermissionsService, RoleContext } from "./permissions.service";

@Controller("permissions")
@UseGuards(AccessGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get("me")
  me(@CurrentRole() role: RoleContext) {
    return this.permissions.me(role.role);
  }

  @Get("roles")
  @RequireAccess("roles", 1)
  listRoles() {
    return this.permissions.listRoles();
  }

  @Get("roles/:name")
  @RequireAccess("roles", 1)
  getRole(@Param("name") name: string) {
    return this.permissions.getRoleMatrix(decodeURIComponent(name));
  }

  @Put("roles/:name")
  @RequireAccess("roles", 2)
  saveRole(
    @CurrentRole() actor: RoleContext,
    @Param("name") name: string,
    @Body() body: { access: Record<string, number> },
  ) {
    return this.permissions.saveRolePermissions(actor, decodeURIComponent(name), body.access || {});
  }

  @Get("assignments")
  @RequireAccess("roles", 1)
  listAssignments(@CurrentRole() actor: RoleContext) {
    return this.permissions.listAssignments(actor);
  }

  @Post("assignments")
  @RequireAccess("roles", 2)
  assign(
    @CurrentRole() actor: RoleContext,
    @Body()
    body: { roleName: string; moduleKey: string; recordId: string; partyLabel?: string; notes?: string },
  ) {
    return this.permissions.assignRecord(actor, body);
  }
}
