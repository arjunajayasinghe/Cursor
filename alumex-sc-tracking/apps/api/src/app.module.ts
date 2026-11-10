import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { AutomationModule } from "./automation/automation.module";
import { VesselTrackingModule } from "./vessel-tracking/vessel-tracking.module";
import { DocumentsModule } from "./documents/documents.module";
import { PrModule } from "./pr/pr.module";
import { PoModule } from "./po/po.module";
import { OverviewModule } from "./overview/overview.module";
import { ModulesModule } from "./modules/modules.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    PermissionsModule,
    AutomationModule,
    VesselTrackingModule,
    DocumentsModule,
    PrModule,
    PoModule,
    OverviewModule,
    ModulesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
