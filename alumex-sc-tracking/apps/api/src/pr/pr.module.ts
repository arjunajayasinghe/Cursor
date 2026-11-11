import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { PrController } from "./pr.controller";
import { PrService } from "./pr.service";

@Module({
  imports: [PlatformModule],
  controllers: [PrController],
  providers: [PrService],
  exports: [PrService],
})
export class PrModule {}
