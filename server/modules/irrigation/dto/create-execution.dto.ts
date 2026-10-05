import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import type { CreateExecutionRequest } from '@shared/api.interface';

export class CreateExecutionDto implements CreateExecutionRequest {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?$/, {
    message: 'executedAt 需为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm 格式',
  })
  executedAt!: string;

  @IsNumber()
  @Min(0)
  amountMm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountM3?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
