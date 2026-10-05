import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

import type { UpdateFarmRequest } from '@shared/api.interface';

export class UpdateFarmDto implements UpdateFarmRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsString()
  cropType?: string;

  @IsOptional()
  @IsString()
  sowingDate?: string;

  @IsOptional()
  @IsString()
  soilType?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  area?: number;

  @IsOptional()
  @IsString()
  irrigationMethod?: string;

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
