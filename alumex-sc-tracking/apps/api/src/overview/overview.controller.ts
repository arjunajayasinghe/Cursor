import { Controller, ForbiddenException, Get, UseGuards } from "@nestjs/common";
import { AccessGuard } from "../permissions/access.guard";
import { CurrentRole } from "../permissions/role.decorator";
import { PermissionsService, RoleContext } from "../permissions/permissions.service";
import { OverviewService } from "./overview.service";

@Controller("overview")
@UseGuards(AccessGuard)
export class OverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  dashboard(@CurrentRole() role: RoleContext) {
    const canSee =
      role.role === "Administrator" ||
      Object.entries(role.access).some(([key, level]) => key !== "roles" && level > 0);
    if (!canSee) {
      throw new ForbiddenException(`${role.role} has no module access for the overview`);
    }
    return this.overview.dashboard(role.role);
  }
}
