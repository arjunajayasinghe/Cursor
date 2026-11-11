import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { PoController } from "./po.controller";
import { PoService } from "./po.service";

@Module({
  imports: [PlatformModule],
  controllers: [PoController],
  providers: [PoService],
  exports: [PoService],
})
export class PoModule {}
