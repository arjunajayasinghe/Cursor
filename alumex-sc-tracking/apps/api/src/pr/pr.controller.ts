import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { AnalyzePrImportDto, CreatePrDto, UpdatePrDto } from "./pr.dto";
import { PrService } from "./pr.service";

@Controller("pr")
export class PrController {
  constructor(private readonly pr: PrService) {}

  @Get()
  list(@Query("q") q?: string, @Query("status") status?: string) {
    return this.pr.list(q, status);
  }

  @Get("groups")
  groups(@Query("q") q?: string, @Query("status") status?: string) {
    return this.pr.groups(q, status);
  }

  @Post("import/analyze")
  analyze(@Body() dto: AnalyzePrImportDto) {
    return this.pr.analyzeImport(dto.text);
  }

  @Post("import/commit")
  commit(@Body() dto: AnalyzePrImportDto) {
    return this.pr.commitImport(dto.text);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.pr.get(id);
  }

  @Post()
  create(@Body() dto: CreatePrDto) {
    return this.pr.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePrDto) {
    return this.pr.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.pr.remove(id);
  }
}
