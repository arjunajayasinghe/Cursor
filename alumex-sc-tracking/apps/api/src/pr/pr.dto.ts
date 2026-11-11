import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class CreatePrDto {
  @IsOptional() @IsString() recordId?: string;
  @IsString() prNo!: string;
  @IsString() line!: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() purchasingGroup?: string;
  @IsOptional() @IsString() createdBy?: string;
  @IsOptional() @IsString() requester?: string;
  @IsOptional() @IsString() changed?: string;
  @IsOptional() @IsString() reportReceived?: string;
  @IsOptional() @IsString() reportDate?: string;
  @IsOptional() @IsNumber() reportDelay?: number;
  @IsOptional() @IsString() delayBand?: string;
  @IsOptional() @IsString() sourcing?: string;
  @IsOptional() @IsString() stockType?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() plant?: string;
  @IsOptional() @IsString() materialCode?: string;
  @IsOptional() @IsString() material?: string;
  @IsOptional() @IsString() materialGroup?: string;
  @IsNumber() quantity!: number;
  @IsOptional() @IsString() uom?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() need?: string;
  @IsOptional() @IsString() approved?: string;
  @IsOptional() @IsString() release?: string;
  @IsOptional() @IsString() handler?: string;
  @IsOptional() @IsString() buyer?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() imported?: boolean;
}

export class UpdatePrDto extends PartialType(CreatePrDto) {}

export class AnalyzePrImportDto {
  @IsString() text!: string;
}
