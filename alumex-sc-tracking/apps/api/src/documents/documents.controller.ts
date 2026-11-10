import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Response } from "express";
import { AccessGuard } from "../permissions/access.guard";
import { CurrentRole } from "../permissions/role.decorator";
import { PermissionsService, RoleContext } from "../permissions/permissions.service";
import { DocumentsService } from "./documents.service";

const MODULE_ACCESS: Record<string, string> = {
  pr: "pr",
  quotes: "quotes",
  eval: "eval",
  po: "po",
  pay: "pay",
  confirm: "confirm",
  ship: "ship",
  vessel: "vessel",
  customs: "customs",
  delivery: "delivery",
  grn: "grn",
};

@Controller("documents")
@UseGuards(AccessGuard)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly permissions: PermissionsService,
  ) {}

  private assertModule(role: RoleContext, moduleKey: string, min: 1 | 2) {
    const accessKey = MODULE_ACCESS[moduleKey] || moduleKey;
    this.permissions.assert(role, accessKey, min);
  }

  @Get()
  list(
    @CurrentRole() role: RoleContext,
    @Query("moduleKey") moduleKey?: string,
    @Query("recordId") recordId?: string,
    @Query("category") category?: string,
  ) {
    if (moduleKey && recordId) {
      this.assertModule(role, moduleKey, 1);
      return this.documents.list(moduleKey, recordId);
    }
    if (category) {
      this.assertModule(role, category, 1);
      return this.documents.listByCategory(category);
    }
    this.permissions.assert(role, "reports", 1);
    return this.documents.listByCategory("pr");
  }

  @Get(":id/download")
  async download(@CurrentRole() role: RoleContext, @Param("id") id: string, @Res() res: Response) {
    const meta = await this.documents.getMeta(id);
    this.assertModule(role, meta.moduleKey, 1);
    const { data, contentType } = await this.documents.download(id);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${meta.fileName.replace(/"/g, "")}"`);
    res.send(data);
  }

  @Get(":id")
  async get(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    const meta = await this.documents.getMeta(id);
    this.assertModule(role, meta.moduleKey, 1);
    return meta;
  }

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentRole() role: RoleContext,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: { category: string; moduleKey: string; recordId: string; notes?: string },
  ) {
    if (!body?.moduleKey || !body?.recordId) {
      throw new BadRequestException("moduleKey and recordId are required");
    }
    this.assertModule(role, body.moduleKey, 2);
    if (!file?.buffer?.length) {
      throw new BadRequestException("file is required");
    }
    return this.documents.upload({
      category: body.category || body.moduleKey,
      moduleKey: body.moduleKey,
      recordId: body.recordId,
      fileName: file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
      uploadedBy: role.role,
      notes: body.notes,
    });
  }

  @Delete(":id")
  async remove(@CurrentRole() role: RoleContext, @Param("id") id: string) {
    const meta = await this.documents.getMeta(id);
    this.assertModule(role, meta.moduleKey, 2);
    if (role.role !== "Administrator" && this.permissions.level(role, meta.moduleKey) < 2) {
      throw new ForbiddenException(`${role.role} cannot delete documents on ${meta.moduleKey}`);
    }
    return this.documents.remove(id);
  }
}
