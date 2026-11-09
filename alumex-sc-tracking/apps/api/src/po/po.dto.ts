import { PartialType } from "@nestjs/mapped-types";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreatePoDto {
  @IsOptional() @IsString() recordId?: string;
  @IsOptional() @IsString() prId?: string;
  @IsOptional() @IsString() purchaseRequisitionId?: string;
  @IsString() poNo!: string;
  @IsString() line!: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() supplierCode?: string;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsString() materialCode?: string;
  @IsOptional() @IsString() material?: string;
  @IsNumber() quantity!: number;
  @IsOptional() @IsString() uom?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() unitPrice?: number;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() incoterm?: string;
  @IsOptional() @IsString() approval?: string;
  @IsOptional() @IsString() approved?: string;
  @IsOptional() @IsString() sapNeed?: string;
  @IsOptional() @IsString() sent?: string;
  @IsOptional() @IsString() importNo?: string;
  @IsOptional() @IsString() piNo?: string;
  @IsOptional() @IsString() piDate?: string;
  @IsOptional() @IsNumber() piAmount?: number;
  @IsOptional() @IsNumber() production?: number;
  @IsOptional() @IsNumber() transit?: number;
  @IsOptional() @IsString() supplierEta?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() status?: string;
}

export class UpdatePoDto extends PartialType(CreatePoDto) {}
