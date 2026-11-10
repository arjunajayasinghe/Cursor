import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AccessGuard } from "../permissions/access.guard";
import { CurrentRole, RequireAccess } from "../permissions/role.decorator";
import { RoleContext } from "../permissions/permissions.service";
import { VesselTrackingService } from "./vessel-tracking.service";

@Controller("vessel-tracking")
@UseGuards(AccessGuard)
export class VesselTrackingController {
  constructor(private readonly vessels: VesselTrackingService) {}

  @Get()
  @RequireAccess("vessel", 1)
  list() {
    return this.vessels.listTrackings();
  }

  @Get("events")
  @RequireAccess("vessel", 1)
  events(@Query("vesselTrackingId") vesselTrackingId?: string, @Query("limit") limit?: string) {
    return this.vessels.listEvents(vesselTrackingId, limit ? Number(limit) : 50);
  }

  @Get(":id")
  @RequireAccess("vessel", 1)
  get(@Param("id") id: string) {
    return this.vessels.getTracking(id);
  }

  @Post("poll")
  @RequireAccess("vessel", 2)
  pollAll(@CurrentRole() role: RoleContext) {
    return this.vessels.pollAll(role.role);
  }

  @Post(":id/poll")
  @RequireAccess("vessel", 2)
  pollOne(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    return this.vessels.pollOne(id, role.role);
  }
}
