import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { PrModule } from "./pr/pr.module";
import { PoModule } from "./po/po.module";
import { OverviewModule } from "./overview/overview.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [PrismaModule, PrModule, PoModule, OverviewModule],
  controllers: [HealthController],
})
export class AppModule {}
