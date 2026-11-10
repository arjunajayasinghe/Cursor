import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AccessGuard } from "../permissions/access.guard";
import { RequireAccess } from "../permissions/role.decorator";
import { WorkbenchService } from "./workbench.service";

@Controller("workbench")
@UseGuards(AccessGuard)
export class WorkbenchController {
  constructor(private readonly workbench: WorkbenchService) {}

  @Get("dashboard")
  @RequireAccess("ship", 1)
  dashboard() {
    return this.workbench.dashboardSummary();
  }

  @Get("pos")
  @RequireAccess("ship", 1)
  list(@Query("q") q?: string) {
    return this.workbench.listPoHeaders(q || "");
  }

  @Get("pos/:poNo")
  @RequireAccess("ship", 1)
  detail(@Param("poNo") poNo: string) {
    return this.workbench.getPoDetail(decodeURIComponent(poNo));
  }

  @Post("pos/:poNo/split")
  @RequireAccess("ship", 2)
  split(
    @Param("poNo") poNo: string,
    @Body()
    body: { line: string; quantity: number; mode: string; notes?: string; coverPoNo?: string },
  ) {
    return this.workbench.splitToShipment(decodeURIComponent(poNo), body);
  }

  @Patch("allocations/:id/short-ship")
  @RequireAccess("ship", 2)
  shortShip(@Param("id") id: string, @Body() body: { shippedQty: number; notes?: string }) {
    return this.workbench.markShortShip(id, body);
  }
}
