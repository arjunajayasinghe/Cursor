import { Module } from "@nestjs/common";
import { AutomationController } from "./automation.controller";
import { AutomationEngine } from "./automation.engine";
import { AutomationService } from "./automation.service";

@Module({
  controllers: [AutomationController],
  providers: [AutomationEngine, AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
