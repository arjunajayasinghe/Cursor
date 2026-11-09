import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ModulesService } from "./modules.service";

@Controller()
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get("modules")
  listDefs() {
    return this.modules.listDefs();
  }

  @Get("reports")
  reports(@Query("type") type?: string) {
    return this.modules.reports(type || "pipeline");
  }

  @Get("quotes")
  listQuotes(@Query("q") q?: string, @Query("status") status?: string) {
    return this.modules.list("quotes", q, status);
  }
  @Get("quotes/:id")
  getQuote(@Param("id") id: string) {
    return this.modules.get("quotes", id);
  }
  @Post("quotes")
  createQuote(@Body() body: Record<string, unknown>) {
    return this.modules.create("quotes", body || {});
  }
  @Patch("quotes/:id")
  updateQuote(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.modules.update("quotes", id, body || {});
  }
  @Delete("quotes/:id")
  removeQuote(@Param("id") id: string) {
    return this.modules.remove("quotes", id);
  }

  @Get("eval")
  listEval(@Query("q") q?: string, @Query("status") status?: string) {
    return this.modules.list("eval", q, status);
  }
  @Get("eval/:id")
  getEval(@Param("id") id: string) {
    return this.modules.get("eval", id);
  }
  @Post("eval")
  createEval(@Body() body: Record<string, unknown>) {
    return this.modules.create("eval", body || {});
  }
  @Patch("eval/:id")
  updateEval(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.modules.update("eval", id, body || {});
  }
  @Delete("eval/:id")
  removeEval(@Param("id") id: string) {
    return this.modules.remove("eval", id);
  }

  @Get("pay")
  listPay(@Query("q") q?: string, @Query("status") status?: string) {
    return this.modules.list("pay", q, status);
  }
  @Get("pay/:id")
  getPay(@Param("id") id: string) {
    return this.modules.get("pay", id);
  }
  @Post("pay")
  createPay(@Body() body: Record<string, unknown>) {
    return this.modules.create("pay", body || {});
  }
  @Patch("pay/:id")
  updatePay(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.modules.update("pay", id, body || {});
  }
  @Delete("pay/:id")
  removePay(@Param("id") id: string) {
    return this.modules.remove("pay", id);
  }

  @Get("confirm")
  listConfirm(@Query("q") q?: string, @Query("status") status?: string) {
    return this.modules.list("confirm", q, status);
  }
  @Get("confirm/:id")
  getConfirm(@Param("id") id: string) {
    return this.modules.get("confirm", id);
  }
  @Post("confirm")
  createConfirm(@Body() body: Record<string, unknown>) {
    return this.modules.create("confirm", body || {});
  }
  @Patch("confirm/:id")
  updateConfirm(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.modules.update("confirm", id, body || {});
  }
  @Delete("confirm/:id")
  removeConfirm(@Param("id") id: string) {
    return this.modules.remove("confirm", id);
  }

  @Get("ship")
  listShip(@Query("q") q?: string, @Query("status") status?: string) {
    return this.modules.list("ship", q, status);
  }
  @Get("ship/:id")
  getShip(@Param("id") id: string) {
    return this.modules.get("ship", id);
  }
  @Post("ship")
  createShip(@Body() body: Record<string, unknown>) {
    return this.modules.create("ship", body || {});
  }
  @Patch("ship/:id")
  updateShip(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.modules.update("ship", id, body || {});
  }
  @Delete("ship/:id")
  removeShip(@Param("id") id: string) {
    return this.modules.remove("ship", id);
  }

  @Get("vessel")
  listVessel(@Query("q") q?: string, @Query("status") status?: string) {
    return this.modules.list("vessel", q, status);
  }
  @Get("vessel/:id")
  getVessel(@Param("id") id: string) {
    return this.modules.get("vessel", id);
  }
  @Post("vessel")
  createVessel(@Body() body: Record<string, unknown>) {
    return this.modules.create("vessel", body || {});
  }
  @Patch("vessel/:id")
  updateVessel(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.modules.update("vessel", id, body || {});
  }
  @Delete("vessel/:id")
  removeVessel(@Param("id") id: string) {
    return this.modules.remove("vessel", id);
  }

  @Get("customs")
  listCustoms(@Query("q") q?: string, @Query("status") status?: string) {
    return this.modules.list("customs", q, status);
  }
  @Get("customs/:id")
  getCustoms(@Param("id") id: string) {
    return this.modules.get("customs", id);
  }
  @Post("customs")
  createCustoms(@Body() body: Record<string, unknown>) {
    return this.modules.create("customs", body || {});
  }
  @Patch("customs/:id")
  updateCustoms(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.modules.update("customs", id, body || {});
  }
  @Delete("customs/:id")
  removeCustoms(@Param("id") id: string) {
    return this.modules.remove("customs", id);
  }

  @Get("delivery")
  listDelivery(@Query("q") q?: string, @Query("status") status?: string) {
    return this.modules.list("delivery", q, status);
  }
  @Get("delivery/:id")
  getDelivery(@Param("id") id: string) {
    return this.modules.get("delivery", id);
  }
  @Post("delivery")
  createDelivery(@Body() body: Record<string, unknown>) {
    return this.modules.create("delivery", body || {});
  }
  @Patch("delivery/:id")
  updateDelivery(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.modules.update("delivery", id, body || {});
  }
  @Delete("delivery/:id")
  removeDelivery(@Param("id") id: string) {
    return this.modules.remove("delivery", id);
  }

  @Get("grn")
  listGrn(@Query("q") q?: string, @Query("status") status?: string) {
    return this.modules.list("grn", q, status);
  }
  @Get("grn/:id")
  getGrn(@Param("id") id: string) {
    return this.modules.get("grn", id);
  }
  @Post("grn")
  createGrn(@Body() body: Record<string, unknown>) {
    return this.modules.create("grn", body || {});
  }
  @Patch("grn/:id")
  updateGrn(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.modules.update("grn", id, body || {});
  }
  @Delete("grn/:id")
  removeGrn(@Param("id") id: string) {
    return this.modules.remove("grn", id);
  }
}
