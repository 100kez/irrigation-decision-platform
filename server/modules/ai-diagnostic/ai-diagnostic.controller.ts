import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import type {
  AiDiagnosticChatResponse,
  AiChatMessage,
} from '@shared/api.interface';

import { AiDiagnosticService } from './ai-diagnostic.service';

class ChatMessageDto {
  @IsString()
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}

class AiDiagnosticChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsOptional()
  @IsString()
  cropType?: string;
}

@Controller('api/ai-diagnostic')
export class AiDiagnosticController {
  constructor(private readonly aiDiagnosticService: AiDiagnosticService) {}

  @Post('chat')
  async chat(
    @Body() dto: AiDiagnosticChatDto,
  ): Promise<AiDiagnosticChatResponse> {
    const messages: AiChatMessage[] = dto.messages.map((m: ChatMessageDto) => ({
      role: m.role,
      content: m.content,
      imageUrls: m.imageUrls,
    }));
    return this.aiDiagnosticService.chat(messages, dto.cropType);
  }
}
