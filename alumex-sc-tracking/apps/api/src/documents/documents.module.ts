import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { LocalObjectStorage } from "./storage/local.storage";
import { S3ObjectStorage } from "./storage/s3.storage";

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, LocalObjectStorage, S3ObjectStorage],
  exports: [DocumentsService],
})
export class DocumentsModule {}
