import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import type { CreateDecisionWithAiRequest } from '@shared/api.interface';

const CRITERION_TYPES = ['wilt', 'root_rot', 'heat_burn', 'pest', 'nutrient', 'normal'] as const;

class AiCriterionDto {
  @IsString()
  @IsIn(CRITERION_TYPES)
  type!: 'wilt' | 'root_rot' | 'heat_burn' | 'pest' | 'nutrient' | 'normal';

  @IsString()
  label!: string;

  @IsString()
  description!: string;

  @IsString()
  impact!: string;
}

class AiChatMessageDto {
  @IsString()
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}

class AiDiagnosticContextDto {
  @IsString()
  chatSummary!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiCriterionDto)
  criteria!: AiCriterionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  messages!: AiChatMessageDto[];
}

export class CreateDecisionDto implements CreateDecisionWithAiRequest {
  @IsUUID()
  @IsNotEmpty()
  farmId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  soilMoisture!: number;

  @IsNumber()
  soilTemperature!: number;

  @IsNumber()
  airTemperature!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  airHumidity!: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AiDiagnosticContextDto)
  aiDiagnosticContext?: AiDiagnosticContextDto;
}
