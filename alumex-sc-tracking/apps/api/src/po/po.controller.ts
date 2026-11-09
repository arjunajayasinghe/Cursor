import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CreatePoDto, UpdatePoDto } from "./po.dto";
import { PoService } from "./po.service";

@Controller("po")
export class PoController {
  constructor(private readonly po: PoService) {}

  @Get()
  list(@Query("q") q?: string, @Query("status") status?: string) {
    return this.po.list(q, status);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.po.get(id);
  }

  @Post()
  create(@Body() dto: CreatePoDto) {
    return this.po.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePoDto) {
    return this.po.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.po.remove(id);
  }
}
