import { Module } from "@nestjs/common";
import { AutomationModule } from "../automation/automation.module";
import { OverviewController } from "./overview.controller";
import { OverviewService } from "./overview.service";

@Module({
  imports: [AutomationModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
