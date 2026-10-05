import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

import type { CreateFarmRequest } from '@shared/api.interface';

export class CreateFarmDto implements CreateFarmRequest {
  @IsString()
  name!: string;

  @IsNumber()
  @Type(() => Number)
  longitude!: number;

  @IsNumber()
  @Type(() => Number)
  latitude!: number;

  @IsString()
  cropType!: string;

  @IsOptional()
  @IsString()
  sowingDate?: string;

  @IsString()
  soilType!: string;

  @IsNumber()
  @Type(() => Number)
  area!: number;

  @IsString()
  irrigationMethod!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fieldCapacity?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  wiltingPoint?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  stressThreshold?: number;
}
