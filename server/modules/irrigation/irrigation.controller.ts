import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import type {
  DashboardResponse,
  DecisionListResponse,
  IrrigationDecisionRecord,
  WeatherData,
  AiDiagnosticCriterion,
  AiChatMessage,
} from '@shared/api.interface';
import {
  DECISION_STATUSES,
  type DecisionStatus,
} from '@shared/decisionMeta';

import { CreateDecisionDto } from './dto/create-decision.dto';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateDecisionStatusDto } from './dto/update-decision-status.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { IrrigationService } from './irrigation.service';
import { WeatherService } from './weather.service';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | undefined, name: string): string | undefined {
  if (!value) return undefined;
  if (!DATE_PATTERN.test(value)) {
    throw new BadRequestException(`${name} 需为 YYYY-MM-DD 格式`);
  }
  return value;
}

@Controller('api/irrigation')
export class IrrigationController {
  constructor(
    private readonly irrigationService: IrrigationService,
    private readonly weatherService: WeatherService,
  ) {}

  @Post('decide')
  async decide(
    @Body() dto: CreateDecisionDto,
  ): Promise<IrrigationDecisionRecord> {
    let aiCriteria: AiDiagnosticCriterion[] | undefined;
    let aiSummary: string | undefined;
    let aiMessages: AiChatMessage[] | undefined;

    if (dto.aiDiagnosticContext) {
      aiCriteria = dto.aiDiagnosticContext.criteria;
      aiSummary = dto.aiDiagnosticContext.chatSummary;
      aiMessages = dto.aiDiagnosticContext.messages;
    }

    return this.irrigationService.createDecision(
      dto.farmId,
      {
        soilMoisture: dto.soilMoisture,
        soilTemperature: dto.soilTemperature,
        airTemperature: dto.airTemperature,
        airHumidity: dto.airHumidity,
      },
      aiCriteria,
      aiSummary,
      aiMessages,
    );
  }

  @Get('weather')
  async getWeather(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
  ): Promise<WeatherData> {
    const latitude: number = Number(lat);
    const longitude: number = Number(lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new BadRequestException('无效的经纬度参数');
    }
    return this.weatherService.getWeather(latitude, longitude);
  }

  @Get('dashboard')
  async getDashboard(
    @Query('range') range?: string,
  ): Promise<DashboardResponse> {
    const validRanges = ['all', '7d', '30d'];
    const resolved = range ?? 'all';
    if (!validRanges.includes(resolved)) {
      throw new BadRequestException('range 仅支持 all/7d/30d');
    }
    return this.irrigationService.getDashboard(resolved as 'all' | '7d' | '30d');
  }

  @Get('decisions')
  async listDecisions(
    @Query('farmId') farmId?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<DecisionListResponse> {
    if (status && !DECISION_STATUSES.includes(status as DecisionStatus)) {
      throw new BadRequestException(
        'status 仅支持 pending/adopted/executed/rejected/superseded',
      );
    }
    if (sort && sort !== 'asc' && sort !== 'desc') {
      throw new BadRequestException('sort 仅支持 asc/desc');
    }
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    if (Number.isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      throw new BadRequestException('pageSize 需在 1-100 之间');
    }

    return this.irrigationService.listDecisions({
      farmId: farmId || undefined,
      status: status as DecisionStatus | undefined,
      sort: sort as 'asc' | 'desc' | undefined,
      dateFrom: parseDateParam(dateFrom, 'dateFrom'),
      dateTo: parseDateParam(dateTo, 'dateTo'),
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSizeNum,
    });
  }

  @Get('decisions/:id')
  async getDecision(@Param('id') id: string): Promise<IrrigationDecisionRecord> {
    return this.irrigationService.getDecision(id);
  }

  @Patch('decisions/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDecisionStatusDto,
  ): Promise<IrrigationDecisionRecord> {
    return this.irrigationService.updateStatus(id, dto.status);
  }

  @Post('decisions/:id/execution')
  async addExecution(
    @Param('id') id: string,
    @Body() dto: CreateExecutionDto,
  ): Promise<IrrigationDecisionRecord> {
    return this.irrigationService.addExecution(id, {
      executedAt: dto.executedAt,
      amountMm: dto.amountMm,
      amountM3: dto.amountM3,
      note: dto.note,
    });
  }

  @Put('decisions/:id/plan')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<IrrigationDecisionRecord> {
    return this.irrigationService.updatePlan(id, dto.events);
  }

  @Delete('decisions/:id')
  async deleteDecision(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ id: string }> {
    const { userId } = req.userContext;
    return this.irrigationService.deleteDecision(id, userId);
  }
}
