import { Module } from "@nestjs/common";
import { PrController } from "./pr.controller";
import { PrService } from "./pr.service";

@Module({
  controllers: [PrController],
  providers: [PrService],
  exports: [PrService],
})
export class PrModule {}
