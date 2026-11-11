import { Module } from "@nestjs/common";
import { MockVesselProvider } from "./providers/mock.provider";
import { RestVesselProvider } from "./providers/rest.provider";
import { VesselTrackingController } from "./vessel-tracking.controller";
import { VesselTrackingService } from "./vessel-tracking.service";

@Module({
  controllers: [VesselTrackingController],
  providers: [MockVesselProvider, RestVesselProvider, VesselTrackingService],
  exports: [VesselTrackingService],
})
export class VesselTrackingModule {}
