import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import type { IrrigationEvent, UpdatePlanRequest } from '@shared/api.interface';

class PlanEventDto implements IrrigationEvent {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 需为 YYYY-MM-DD 格式' })
  date!: string;

  @IsNumber()
  @Min(0)
  amountMm!: number;

  @IsNumber()
  @Min(0)
  amountM3!: number;

  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class UpdatePlanDto implements UpdatePlanRequest {
  @IsArray()
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => PlanEventDto)
  events!: PlanEventDto[];
}
