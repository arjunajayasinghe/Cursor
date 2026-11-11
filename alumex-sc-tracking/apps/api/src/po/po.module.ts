import { Module } from "@nestjs/common";
import { PoController } from "./po.controller";
import { PoService } from "./po.service";

@Module({
  controllers: [PoController],
  providers: [PoService],
  exports: [PoService],
})
export class PoModule {}
