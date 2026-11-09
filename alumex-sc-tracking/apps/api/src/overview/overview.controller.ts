import { Controller, Get } from "@nestjs/common";
import { OverviewService } from "./overview.service";

@Controller("overview")
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  dashboard() {
    return this.overview.dashboard();
  }
}
