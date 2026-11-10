import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { AutomationModule } from "./automation/automation.module";
import { PrModule } from "./pr/pr.module";
import { PoModule } from "./po/po.module";
import { OverviewModule } from "./overview/overview.module";
import { ModulesModule } from "./modules/modules.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    PrismaModule,
    PermissionsModule,
    AutomationModule,
    PrModule,
    PoModule,
    OverviewModule,
    ModulesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
