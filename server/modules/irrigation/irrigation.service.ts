import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { and, asc, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';

import type {
  DashboardResponse,
  DecisionListResponse,
  Farm,
  IrrigationDecisionRecord,
  IrrigationDecisionResult,
  IrrigationEvent,
  PendingActionItem,
  RecentDecisionItem,
  WaterRiskLevel,
  WaterStorageDay,
  WeatherData,
  AiDiagnosticCriterion,
  AiDiagnosticCriterionType,
  AiChatMessage,
} from '@shared/api.interface';
import {
  DECISION_STATUSES,
  getFutureRisk,
  getMoistureStatus,
  type DecisionStatus,
  type ExecutionRecord,
  type MoistureStatus,
} from '@shared/decisionMeta';

import { farm, irrigationDecision } from '@server/database/schema';

import { AiDiagnosticService } from '../ai-diagnostic/ai-diagnostic.service';
import { WeatherService } from './weather.service';

interface DecisionRow {
  id: string;
  farmId: string;
  farmName: string | null;
  soilMoisture: string | number;
  soilTemperature: string | number;
  airTemperature: string | number;
  airHumidity: string | number;
  weatherData: unknown;
  waterStorageDaily: unknown;
  waterRiskLevel: string;
  stressForecastDate: string | null;
  irrigationPlan: unknown;
  aiDiagnosticCriteria: unknown;
  aiDiagnosticSummary: string | null;
  aiChatMessages: unknown;
  status: string;
  executionRecords: unknown;
  adjustedPlan: unknown | null;
  aiModel: string | null;
  createdAt: Date;
}

const CROP_KC_MAP: Record<string, [number, number, number, number]> = {
  maize: [0.3, 0.7, 1.2, 0.6],
  wheat: [0.4, 0.8, 1.15, 0.4],
  rice: [1.05, 1.2, 1.2, 0.9],
  cotton: [0.35, 0.75, 1.15, 0.75],
  soybean: [0.4, 0.8, 1.15, 0.5],
  tomato: [0.45, 0.75, 1.1, 0.8],
  default: [0.35, 0.7, 1.05, 0.65],
};

const ROOT_DEPTH_MM = 1000;
const LATENT_HEAT = 2.45; // MJ/kg, 汽化潜热
const MIN_IRRIGATION_MM = 5;
const IRRIGATION_TARGET_RATIO = 0.8; // 灌溉到田间持水量的80%
const GROWTH_PERIOD_DAYS = 120;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getCropKc(cropType: string, growthDay: number): number {
  const key = Object.keys(CROP_KC_MAP).includes(cropType) ? cropType : 'default';
  const [kcInit, _kcDev, kcMid, kcLate] = CROP_KC_MAP[key];

  if (growthDay <= 20) {
    return kcInit;
  }
  if (growthDay <= 50) {
    const ratio = (growthDay - 20) / 30;
    return kcInit + (kcMid - kcInit) * ratio;
  }
  if (growthDay <= 90) {
    return kcMid;
  }
  if (growthDay <= GROWTH_PERIOD_DAYS) {
    const ratio = (growthDay - 90) / 30;
    return kcMid + (kcLate - kcMid) * ratio;
  }
  return kcLate;
}

function calcGrowthDays(sowingDateStr: string, today: Date): number {
  const sowing = new Date(sowingDateStr + 'T00:00:00');
  const diffMs = today.getTime() - sowing.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getShanghaiDate(d: Date): string {
  const year: number = d.getFullYear();
  const month: string = String(d.getMonth() + 1).padStart(2, '0');
  const day: string = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return getShanghaiDate(d);
}

@Injectable()
export class IrrigationService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly weatherService: WeatherService,
    private readonly aiDiagnosticService: AiDiagnosticService,
  ) {}

  async createDecision(
    farmId: string,
    fieldData: {
      soilMoisture: number;
      soilTemperature: number;
      airTemperature: number;
      airHumidity: number;
    },
    aiCriteria?: AiDiagnosticCriterion[],
    aiSummary?: string,
    aiMessages?: AiChatMessage[],
  ): Promise<IrrigationDecisionRecord> {
    const farmRecord = await this.db
      .select()
      .from(farm)
      .where(eq(farm.id, farmId))
      .limit(1);

    if (farmRecord.length === 0) {
      throw new NotFoundException('农田不存在');
    }

    const farmRow = farmRecord[0];
    const lat = Number(farmRow.latitude);
    const lon = Number(farmRow.longitude);

    let weatherData: WeatherData;
    try {
      weatherData = await this.weatherService.getWeather(lat, lon);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`天气服务异常: ${message}`);
    }

    const farmInfo: Farm = {
      id: farmRow.id,
      name: farmRow.name,
      longitude: Number(farmRow.longitude),
      latitude: Number(farmRow.latitude),
      cropType: farmRow.cropType,
      sowingDate:
        typeof farmRow.sowingDate === 'string'
          ? farmRow.sowingDate
          : getShanghaiDate(farmRow.sowingDate as Date),
      soilType: farmRow.soilType,
      area: Number(farmRow.area),
      irrigationMethod: farmRow.irrigationMethod,
      fieldCapacity: Number(farmRow.fieldCapacity),
      wiltingPoint: Number(farmRow.wiltingPoint),
      stressThreshold: Number(farmRow.stressThreshold),
      createdAt:
        farmRow.createdAt instanceof Date
          ? farmRow.createdAt.toISOString()
          : String(farmRow.createdAt),
    };

    const decision: IrrigationDecisionResult = this.calculateDecision(
      farmInfo,
      fieldData,
      weatherData,
      aiCriteria,
    );

    // 同农田旧的待确认/已采纳方案置为已替代;与新记录插入同事务保证一致
    const inserted = await this.db.transaction(async (tx) => {
      await tx
        .update(irrigationDecision)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(irrigationDecision.farmId, farmRow.id),
            inArray(irrigationDecision.status, ['pending', 'adopted']),
          ),
        );

      const rows = await tx
        .insert(irrigationDecision)
        .values({
          farmId: farmRow.id,
          soilMoisture: String(fieldData.soilMoisture),
          soilTemperature: String(fieldData.soilTemperature),
          airTemperature: String(fieldData.airTemperature),
          airHumidity: String(fieldData.airHumidity),
          weatherData: JSON.stringify(weatherData),
          waterStorageDaily: JSON.stringify(decision.waterStorageDaily),
          waterRiskLevel: decision.waterRiskLevel,
          stressForecastDate: decision.stressForecastDate ?? null,
          irrigationPlan: JSON.stringify(decision.irrigationPlan),
          aiDiagnosticCriteria: JSON.stringify(aiCriteria ?? []),
          aiDiagnosticSummary: aiSummary ?? null,
          aiChatMessages: JSON.stringify(aiMessages ?? []),
          status: 'pending',
          executionRecords: '[]',
          aiModel: this.aiDiagnosticService.getModelConfig().model,
        })
        .returning({
          id: irrigationDecision.id,
          createdAt: irrigationDecision.createdAt,
        });
      return rows;
    });

    return {
      id: inserted[0].id,
      farmId: farmRow.id,
      farmName: farmRow.name,
      soilMoisture: fieldData.soilMoisture,
      soilTemperature: fieldData.soilTemperature,
      airTemperature: fieldData.airTemperature,
      airHumidity: fieldData.airHumidity,
      weatherData,
      waterStorageDaily: decision.waterStorageDaily,
      waterRiskLevel: decision.waterRiskLevel,
      stressForecastDate: decision.stressForecastDate,
      irrigationPlan: decision.irrigationPlan,
      aiDiagnosticCriteria: aiCriteria,
      aiDiagnosticSummary: aiSummary,
      aiChatMessages: aiMessages,
      status: 'pending',
      executionRecords: [],
      aiModel: this.aiDiagnosticService.getModelConfig().model,
      createdAt:
        inserted[0].createdAt instanceof Date
          ? inserted[0].createdAt.toISOString()
          : String(inserted[0].createdAt),
    };
  }

  calculateDecision(
    farmInfo: Farm,
    fieldData: {
      soilMoisture: number;
      soilTemperature: number;
      airTemperature: number;
      airHumidity: number;
    },
    weatherData: WeatherData,
    aiCriteria?: AiDiagnosticCriterion[],
  ): IrrigationDecisionResult {
    const { soilMoisture } = fieldData;
    const fieldCapacityMm: number = (farmInfo.fieldCapacity / 100) * ROOT_DEPTH_MM;
    const stressMm: number = (farmInfo.stressThreshold / 100) * ROOT_DEPTH_MM;
    const targetMm: number = fieldCapacityMm * IRRIGATION_TARGET_RATIO;

    // 当前日期（上海时区）
    const now = new Date();
    const todayStr = getShanghaiDate(now);
    const growthDay: number = calcGrowthDays(farmInfo.sowingDate, now);

    // 逐日水量平衡
    let currentStorage: number = (soilMoisture / 100) * ROOT_DEPTH_MM;
    const waterStorageDaily: WaterStorageDay[] = [];
    const daily: typeof weatherData.daily = weatherData.daily;

    for (let i = 0; i < daily.length; i++) {
      const day = daily[i];
      const dayGrowthDay: number = growthDay + i;
      const kc: number = getCropKc(farmInfo.cropType, dayGrowthDay);

      // ET0: 简化公式 0.0135 * (Tmean + 17.3) * Rs / λ
      // Rs = solarRadiation (MJ/m²/day)
      const et0: number = 0.0135 * (day.temperatureAvg + 17.3) * day.solarRadiation / LATENT_HEAT;
      const etc: number = et0 * kc;

      const storageBefore: number = currentStorage;
      let storageAfter: number = currentStorage + day.rainfall - etc;

      // 不能超过田间持水量，超过部分流失
      if (storageAfter > fieldCapacityMm) {
        storageAfter = fieldCapacityMm;
      }
      // 不能低于 0（物理下限）
      if (storageAfter < 0) {
        storageAfter = 0;
      }

      const dateStr: string = i === 0 ? todayStr : addDays(todayStr, i);

      waterStorageDaily.push({
        date: dateStr,
        et0: round2(et0),
        etc: round2(etc),
        rainfall: round2(day.rainfall),
        storage: round2(storageAfter),
        storageChange: round2(storageAfter - storageBefore),
      });

      currentStorage = storageAfter;
    }

    // 水分风险等级（基于当前土壤含水率）
    const currentRatio: number = soilMoisture / farmInfo.fieldCapacity;

    let waterRiskLevel: WaterRiskLevel;
    if (soilMoisture < farmInfo.wiltingPoint) {
      waterRiskLevel = 'drought';
    } else if (soilMoisture < farmInfo.stressThreshold) {
      waterRiskLevel = 'stress';
    } else if (currentRatio < 0.8) {
      waterRiskLevel = 'normal';
    } else if (currentRatio <= 1) {
      waterRiskLevel = 'wet';
    } else {
      waterRiskLevel = 'flood';
    }

    // AI 判据调整风险等级
    if (aiCriteria && aiCriteria.length > 0) {
      waterRiskLevel = this.adjustRiskByAiCriteria(
        waterRiskLevel,
        aiCriteria,
      );
    }

    // 预期胁迫发生时间：在 waterStorageDaily 中找到第一个 storage < stressMm 的日期
    let stressForecastDate: string | null = null;
    for (const day of waterStorageDaily) {
      if (day.storage < stressMm) {
        stressForecastDate = day.date;
        break;
      }
    }

    // 精准灌溉方案
    let irrigationPlan: IrrigationEvent[] = this.generateIrrigationPlan(
      waterStorageDaily,
      fieldCapacityMm,
      stressMm,
      targetMm,
      farmInfo.area,
    );

    // AI 判据调整灌溉方案说明
    if (aiCriteria && aiCriteria.length > 0 && irrigationPlan.length > 0) {
      irrigationPlan = this.adjustIrrigationPlanByAi(
        irrigationPlan,
        aiCriteria,
      );
    }

    const totalIrrigationMm: number = round2(
      irrigationPlan.reduce((sum: number, e: IrrigationEvent) => sum + e.amountMm, 0),
    );
    const totalIrrigationM3: number = round2(
      irrigationPlan.reduce((sum: number, e: IrrigationEvent) => sum + e.amountM3, 0),
    );

    const totalWaterStorageChange: number = round2(
      waterStorageDaily.reduce(
        (sum: number, d: WaterStorageDay) => sum + d.storageChange,
        0,
      ),
    );

    return {
      waterStorageDaily,
      totalWaterStorageChange,
      finalStorage: round2(currentStorage),
      waterRiskLevel,
      stressForecastDate,
      irrigationPlan,
      totalIrrigationMm,
      totalIrrigationM3,
    };
  }

  private adjustRiskByAiCriteria(
    baseLevel: WaterRiskLevel,
    criteria: AiDiagnosticCriterion[],
  ): WaterRiskLevel {
    const riskOrder: WaterRiskLevel[] = ['flood', 'wet', 'normal', 'stress', 'drought'];
    const baseIndex: number = riskOrder.indexOf(baseLevel);
    let shift = 0;

    for (const c of criteria) {
      switch (c.type) {
        case 'wilt':
          shift += 1;
          break;
        case 'heat_burn':
          shift += 1;
          break;
        case 'root_rot':
          shift -= 1;
          break;
        case 'pest':
          shift += 0;
          break;
        case 'nutrient':
          shift += 0;
          break;
        case 'normal':
        default:
          break;
      }
    }

    const newIndex: number = Math.max(
      0,
      Math.min(riskOrder.length - 1, baseIndex + shift),
    );
    return riskOrder[newIndex];
  }

  private adjustIrrigationPlanByAi(
    plan: IrrigationEvent[],
    criteria: AiDiagnosticCriterion[],
  ): IrrigationEvent[] {
    if (plan.length === 0) return plan;

    const hasHeatBurn = criteria.some(
      (c: AiDiagnosticCriterion) => c.type === 'heat_burn',
    );
    const hasRootRot = criteria.some(
      (c: AiDiagnosticCriterion) => c.type === 'root_rot',
    );
    const hasWilt = criteria.some(
      (c: AiDiagnosticCriterion) => c.type === 'wilt',
    );

    return plan.map((event: IrrigationEvent, idx: number) => {
      const notes: string[] = [];
      let adjustedAmount = event.amountMm;
      let adjustedM3 = event.amountM3;

      if (idx === 0 && hasWilt) {
        adjustedAmount = event.amountMm * 1.15;
        adjustedM3 = event.amountM3 * 1.15;
        notes.push('AI诊断叶片萎蔫，首次灌溉量增加15%以快速缓解胁迫');
      }

      if (hasHeatBurn) {
        notes.push('高温灼伤风险，建议选择清晨或傍晚时段灌溉，避免正午高温');
      }

      if (hasRootRot) {
        adjustedAmount = event.amountMm * 0.8;
        adjustedM3 = event.amountM3 * 0.8;
        notes.push('根部病害风险，减少灌溉量20%，注意田间排水');
      }

      if (notes.length > 0) {
        return {
          ...event,
          amountMm: round2(adjustedAmount),
          amountM3: round2(adjustedM3),
          reason: `${event.reason}（${notes.join('；')}）`,
        };
      }
      return event;
    });
  }

  private generateIrrigationPlan(
    waterStorageDaily: WaterStorageDay[],
    fieldCapacityMm: number,
    stressMm: number,
    targetMm: number,
    areaM2: number,
  ): IrrigationEvent[] {
    const plan: IrrigationEvent[] = [];
    const dailyStorage: number[] = waterStorageDaily.map((d: WaterStorageDay) => d.storage);
    const dailyEtc: number[] = waterStorageDaily.map((d: WaterStorageDay) => d.etc);
    const dailyRainfall: number[] = waterStorageDaily.map((d: WaterStorageDay) => d.rainfall);

    for (let i = 0; i < dailyStorage.length; i++) {
      if (dailyStorage[i] < stressMm) {
        const amountMm: number = Math.max(targetMm - dailyStorage[i] + dailyEtc[i] - dailyRainfall[i], 0);
        if (amountMm < MIN_IRRIGATION_MM) continue;

        const amountM3: number = (amountMm * areaM2) / 1000;
        plan.push({
          date: waterStorageDaily[i].date,
          amountMm: round2(amountMm),
          amountM3: round2(amountM3),
          reason: `土壤含水量降至胁迫阈值（${round2(stressMm)}mm）以下，补充灌溉至田间持水量的${IRRIGATION_TARGET_RATIO * 100}%`,
        });

        // 更新当天蓄水量：加上灌溉量 - ETc + 降雨
        dailyStorage[i] = Math.min(dailyStorage[i] + amountMm + dailyRainfall[i] - dailyEtc[i], fieldCapacityMm);

        // 重新推演后续天数的蓄水量
        for (let j = i + 1; j < dailyStorage.length; j++) {
          dailyStorage[j] = dailyStorage[j - 1] + dailyRainfall[j] - dailyEtc[j];
          if (dailyStorage[j] > fieldCapacityMm) dailyStorage[j] = fieldCapacityMm;
          if (dailyStorage[j] < 0) dailyStorage[j] = 0;
        }
      }
    }
    return plan;
  }

  async listDecisions(params: {
    farmId?: string;
    status?: DecisionStatus;
    sort?: 'asc' | 'desc';
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }): Promise<DecisionListResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const offset: number = (page - 1) * pageSize;

    const conditions = [];
    if (params.farmId) {
      conditions.push(eq(irrigationDecision.farmId, params.farmId));
    }
    if (params.status) {
      conditions.push(eq(irrigationDecision.status, params.status));
    }
    if (params.dateFrom) {
      conditions.push(
        gte(
          irrigationDecision.createdAt,
          new Date(`${params.dateFrom}T00:00:00`),
        ),
      );
    }
    if (params.dateTo) {
      conditions.push(
        lte(
          irrigationDecision.createdAt,
          new Date(`${params.dateTo}T23:59:59`),
        ),
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = where
      ? this.db
          .select({ count: count() })
          .from(irrigationDecision)
          .where(where)
      : this.db.select({ count: count() }).from(irrigationDecision);

    const rowsBase = this.db
      .select({
        id: irrigationDecision.id,
        farmId: irrigationDecision.farmId,
        farmName: farm.name,
        soilMoisture: irrigationDecision.soilMoisture,
        soilTemperature: irrigationDecision.soilTemperature,
        airTemperature: irrigationDecision.airTemperature,
        airHumidity: irrigationDecision.airHumidity,
        weatherData: irrigationDecision.weatherData,
        waterStorageDaily: irrigationDecision.waterStorageDaily,
        waterRiskLevel: irrigationDecision.waterRiskLevel,
        stressForecastDate: irrigationDecision.stressForecastDate,
        irrigationPlan: irrigationDecision.irrigationPlan,
        aiDiagnosticCriteria: irrigationDecision.aiDiagnosticCriteria,
        aiDiagnosticSummary: irrigationDecision.aiDiagnosticSummary,
        aiChatMessages: irrigationDecision.aiChatMessages,
        status: irrigationDecision.status,
        executionRecords: irrigationDecision.executionRecords,
        adjustedPlan: irrigationDecision.adjustedPlan,
        aiModel: irrigationDecision.aiModel,
        createdAt: irrigationDecision.createdAt,
      })
      .from(irrigationDecision)
      .leftJoin(farm, eq(irrigationDecision.farmId, farm.id));

    const rowsQuery = where ? rowsBase.where(where) : rowsBase;

    const orderFn = params.sort === 'asc' ? asc : desc;

    const [totalResult, rows] = await Promise.all([
      countQuery,
      rowsQuery
        .orderBy(orderFn(irrigationDecision.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const items: IrrigationDecisionRecord[] = rows.map((row: DecisionRow) =>
      this.mapRowToRecord(row),
    );

    return { items, total: Number(totalResult[0]?.count ?? 0) };
  }

  async getDecision(id: string): Promise<IrrigationDecisionRecord> {
    const rows: DecisionRow[] = await this.db
      .select({
        id: irrigationDecision.id,
        farmId: irrigationDecision.farmId,
        farmName: farm.name,
        soilMoisture: irrigationDecision.soilMoisture,
        soilTemperature: irrigationDecision.soilTemperature,
        airTemperature: irrigationDecision.airTemperature,
        airHumidity: irrigationDecision.airHumidity,
        weatherData: irrigationDecision.weatherData,
        waterStorageDaily: irrigationDecision.waterStorageDaily,
        waterRiskLevel: irrigationDecision.waterRiskLevel,
        stressForecastDate: irrigationDecision.stressForecastDate,
        irrigationPlan: irrigationDecision.irrigationPlan,
        aiDiagnosticCriteria: irrigationDecision.aiDiagnosticCriteria,
        aiDiagnosticSummary: irrigationDecision.aiDiagnosticSummary,
        aiChatMessages: irrigationDecision.aiChatMessages,
        status: irrigationDecision.status,
        executionRecords: irrigationDecision.executionRecords,
        adjustedPlan: irrigationDecision.adjustedPlan,
        aiModel: irrigationDecision.aiModel,
        createdAt: irrigationDecision.createdAt,
      })
      .from(irrigationDecision)
      .leftJoin(farm, eq(irrigationDecision.farmId, farm.id))
      .where(eq(irrigationDecision.id, id));

    if (rows.length === 0) {
      throw new NotFoundException('决策记录不存在');
    }

    return this.mapRowToRecord(rows[0]);
  }

  async deleteDecision(id: string, userId: string): Promise<{ id: string }> {
    void userId;
    const deleted: { id: string }[] = await this.db
      .delete(irrigationDecision)
      .where(eq(irrigationDecision.id, id))
      .returning({ id: irrigationDecision.id });

    if (deleted.length === 0) {
      throw new NotFoundException('决策记录不存在');
    }

    return { id: deleted[0].id };
  }

  /**
   * 方案状态流转。仅 pending/adopted/rejected 之间可改(adopted↔rejected 双向);
   * executed 是事实记录、superseded 已被新方案取代,均不可变更。
   */
  async updateStatus(
    id: string,
    status: 'adopted' | 'rejected',
  ): Promise<IrrigationDecisionRecord> {
    const rows = await this.db
      .select({ status: irrigationDecision.status })
      .from(irrigationDecision)
      .where(eq(irrigationDecision.id, id))
      .limit(1);

    const current = rows[0];
    if (!current) {
      throw new NotFoundException('决策记录不存在');
    }
    if (!['pending', 'adopted', 'rejected'].includes(current.status)) {
      throw new ConflictException(
        `当前状态为「${current.status}」，不可变更`,
      );
    }

    await this.db
      .update(irrigationDecision)
      .set({ status })
      .where(eq(irrigationDecision.id, id));

    return this.getDecision(id);
  }

  /**
   * 记录一次实际执行。可重复追加(同一方案分多次灌溉);
   * 成功后状态置 executed。amountM3 缺省时按农田面积换算。
   */
  async addExecution(
    id: string,
    dto: { executedAt: string; amountMm: number; amountM3?: number; note?: string },
  ): Promise<IrrigationDecisionRecord> {
    const rows = await this.db
      .select({
        farmId: irrigationDecision.farmId,
        status: irrigationDecision.status,
        executionRecords: irrigationDecision.executionRecords,
      })
      .from(irrigationDecision)
      .where(eq(irrigationDecision.id, id))
      .limit(1);

    const current = rows[0];
    if (!current) {
      throw new NotFoundException('决策记录不存在');
    }
    if (current.status === 'superseded') {
      throw new ConflictException('该方案已被新方案替代，请在新方案上记录执行');
    }

    let amountM3 = dto.amountM3;
    if (amountM3 === undefined) {
      const farmRows = await this.db
        .select({ area: farm.area })
        .from(farm)
        .where(eq(farm.id, current.farmId))
        .limit(1);
      const area = farmRows[0] ? Number(farmRows[0].area) : 0;
      amountM3 = round2((dto.amountMm * area) / 1000);
    }

    const record: ExecutionRecord = {
      executedAt: dto.executedAt,
      amountMm: dto.amountMm,
      amountM3,
      ...(dto.note ? { note: dto.note } : {}),
    };

    const existing = this.parseJson<ExecutionRecord[]>(current.executionRecords) ?? [];

    await this.db
      .update(irrigationDecision)
      .set({
        status: 'executed',
        executionRecords: JSON.stringify([...existing, record]),
      })
      .where(eq(irrigationDecision.id, id));

    return this.getDecision(id);
  }

  /** 保存人工调整后的灌溉方案(可清空)。已替代方案不可调整。 */
  async updatePlan(
    id: string,
    events: IrrigationEvent[],
  ): Promise<IrrigationDecisionRecord> {
    const rows = await this.db
      .select({ status: irrigationDecision.status })
      .from(irrigationDecision)
      .where(eq(irrigationDecision.id, id))
      .limit(1);

    const current = rows[0];
    if (!current) {
      throw new NotFoundException('决策记录不存在');
    }
    if (current.status === 'superseded') {
      throw new ConflictException('该方案已被新方案替代，不可调整');
    }

    await this.db
      .update(irrigationDecision)
      .set({ adjustedPlan: JSON.stringify(events) })
      .where(eq(irrigationDecision.id, id));

    return this.getDecision(id);
  }

  /**
   * 首页聚合。range 仅影响水量/次数统计口径;风险农田数与农田状态卡基于全时段最新决策。
   */
  async getDashboard(range: 'all' | '7d' | '30d'): Promise<DashboardResponse> {
    const cutoff: Date | null =
      range === '7d'
        ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        : range === '30d'
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          : null;

    // 1) 农田列表
    const farmRows = await this.db.select().from(farm);

    // 2) 每田最新决策(全时段,一次查询复用为风险统计与状态卡)
    const latestRows = await this.db
      .selectDistinctOn([irrigationDecision.farmId], {
        farmId: irrigationDecision.farmId,
        id: irrigationDecision.id,
        soilMoisture: irrigationDecision.soilMoisture,
        waterRiskLevel: irrigationDecision.waterRiskLevel,
        stressForecastDate: irrigationDecision.stressForecastDate,
        status: irrigationDecision.status,
        waterStorageDaily: irrigationDecision.waterStorageDaily,
        createdAt: irrigationDecision.createdAt,
      })
      .from(irrigationDecision)
      .orderBy(
        irrigationDecision.farmId,
        desc(irrigationDecision.createdAt),
      );

    const latestByFarm = new Map<string, (typeof latestRows)[number]>();
    for (const row of latestRows) {
      latestByFarm.set(row.farmId, row);
    }

    // 3) 待处理方案(status ∈ pending/adopted,取最近 20 条再按风险/计划过滤)
    const pendingRows = await this.db
      .select({
        id: irrigationDecision.id,
        farmId: irrigationDecision.farmId,
        farmName: farm.name,
        waterRiskLevel: irrigationDecision.waterRiskLevel,
        stressForecastDate: irrigationDecision.stressForecastDate,
        status: irrigationDecision.status,
        irrigationPlan: irrigationDecision.irrigationPlan,
        adjustedPlan: irrigationDecision.adjustedPlan,
        createdAt: irrigationDecision.createdAt,
      })
      .from(irrigationDecision)
      .leftJoin(farm, eq(irrigationDecision.farmId, farm.id))
      .where(
        inArray(irrigationDecision.status, ['pending', 'adopted']),
      )
      .orderBy(desc(irrigationDecision.createdAt))
      .limit(20);

    const pendingActions: PendingActionItem[] = [];
    for (const row of pendingRows) {
      const plan = this.parseJson<IrrigationEvent[]>(
        row.adjustedPlan ?? row.irrigationPlan,
      ) ?? [];
      const needsAttention =
        row.waterRiskLevel === 'drought' ||
        row.waterRiskLevel === 'stress' ||
        plan.length > 0;
      if (!needsAttention) continue;
      const suggestedMm = round2(
        plan.reduce((sum: number, e: IrrigationEvent) => sum + e.amountMm, 0),
      );
      const suggestedM3 = round2(
        plan.reduce((sum: number, e: IrrigationEvent) => sum + e.amountM3, 0),
      );
      pendingActions.push({
        id: row.id,
        farmId: row.farmId,
        farmName: row.farmName ?? '',
        waterRiskLevel: row.waterRiskLevel as WaterRiskLevel,
        stressForecastDate: row.stressForecastDate,
        status: row.status as DecisionStatus,
        createdAt: row.createdAt.toISOString(),
        suggestedMm,
        suggestedM3,
        eventCount: plan.length,
      });
    }

    // 4) 最近决策(10 条轻量投影)
    const recentRows = await this.db
      .select({
        id: irrigationDecision.id,
        farmId: irrigationDecision.farmId,
        farmName: farm.name,
        waterRiskLevel: irrigationDecision.waterRiskLevel,
        status: irrigationDecision.status,
        irrigationPlan: irrigationDecision.irrigationPlan,
        adjustedPlan: irrigationDecision.adjustedPlan,
        createdAt: irrigationDecision.createdAt,
      })
      .from(irrigationDecision)
      .leftJoin(farm, eq(irrigationDecision.farmId, farm.id))
      .orderBy(desc(irrigationDecision.createdAt))
      .limit(10);

    const recentDecisions: RecentDecisionItem[] = recentRows.map((row) => {
      const plan = this.parseJson<IrrigationEvent[]>(
        row.adjustedPlan ?? row.irrigationPlan,
      ) ?? [];
      return {
        id: row.id,
        farmId: row.farmId,
        farmName: row.farmName ?? '',
        waterRiskLevel: row.waterRiskLevel as WaterRiskLevel,
        status: row.status as DecisionStatus,
        createdAt: row.createdAt.toISOString(),
        suggestedMm: round2(
          plan.reduce((sum: number, e: IrrigationEvent) => sum + e.amountMm, 0),
        ),
      };
    });

    // 5) 范围统计(建议量口径 adjustedPlan ?? irrigationPlan,执行量来自 execution_records)
    const rangeWhere = cutoff
      ? gte(irrigationDecision.createdAt, cutoff)
      : undefined;
    const countQuery = rangeWhere
      ? this.db
          .select({ count: count() })
          .from(irrigationDecision)
          .where(rangeWhere)
      : this.db.select({ count: count() }).from(irrigationDecision);

    const sumRows = await this.db
      .select({
        irrigationPlan: irrigationDecision.irrigationPlan,
        adjustedPlan: irrigationDecision.adjustedPlan,
        executionRecords: irrigationDecision.executionRecords,
      })
      .from(irrigationDecision)
      .where(rangeWhere ? rangeWhere : undefined)
      .limit(10000);

    let suggestedM3 = 0;
    let suggestedEvents = 0;
    let executedM3 = 0;
    let executedEvents = 0;
    for (const row of sumRows) {
      const plan =
        this.parseJson<IrrigationEvent[]>(row.adjustedPlan ?? row.irrigationPlan) ?? [];
      suggestedEvents += plan.length;
      suggestedM3 += plan.reduce((s: number, e: IrrigationEvent) => s + e.amountM3, 0);
      const records = this.parseJson<ExecutionRecord[]>(row.executionRecords) ?? [];
      executedEvents += records.length;
      executedM3 += records.reduce((s: number, e: ExecutionRecord) => s + e.amountM3, 0);
    }

    // 6) 待确认方案数(全时段)
    const pendingCountResult = await this.db
      .select({ count: count() })
      .from(irrigationDecision)
      .where(inArray(irrigationDecision.status, ['pending', 'adopted']));

    // 7) 农田状态卡
    const farmStatuses = farmRows.map((row) => {
      const latest = latestByFarm.get(row.id);
      const currentMoisture = latest ? Number(latest.soilMoisture) : null;
      const thresholds = {
        fieldCapacity: Number(row.fieldCapacity),
        stressThreshold: Number(row.stressThreshold),
        wiltingPoint: Number(row.wiltingPoint),
      };
      const daily = latest
        ? this.parseJson<WaterStorageDay[]>(latest.waterStorageDaily) ?? []
        : [];
      // 24h 预测水分:storage 单位为 mm,除以根深 1000mm 的 1/100 换算回 %
      const predicted24hMoisture = daily.length > 0
        ? round2(Number(daily[0].storage) / 10)
        : null;

      return {
        farmId: row.id,
        name: row.name,
        area: Number(row.area),
        cropType: row.cropType,
        currentMoisture,
        moistureStatus: getMoistureStatus(currentMoisture, thresholds),
        predicted24hMoisture,
        futureRisk: getFutureRisk(
          latest?.waterRiskLevel as WaterRiskLevel | undefined,
          latest?.stressForecastDate ?? undefined,
        ),
        latestDecisionId: latest?.id ?? null,
        latestDecisionStatus: (latest?.status as DecisionStatus) ?? null,
        lastUpdatedAt: latest ? latest.createdAt.toISOString() : null,
        hasData: !!latest,
      };
    });

    const riskFarmCount = farmStatuses.filter(
      (f) =>
        f.hasData &&
        (latestByFarm.get(f.farmId)?.waterRiskLevel === 'drought' ||
          latestByFarm.get(f.farmId)?.waterRiskLevel === 'stress'),
    ).length;

    return {
      range,
      stats: {
        farmCount: farmRows.length,
        decisionCount: Number((await countQuery)[0]?.count ?? 0),
        suggestedM3: round2(suggestedM3),
        suggestedEvents,
        executedM3: round2(executedM3),
        executedEvents,
        riskFarmCount,
        pendingCount: Number(pendingCountResult[0]?.count ?? 0),
      },
      farmStatuses,
      pendingActions,
      recentDecisions,
    };
  }

  private mapRowToRecord(row: DecisionRow): IrrigationDecisionRecord {
    return {
      id: row.id,
      farmId: row.farmId,
      farmName: row.farmName ?? '',
      soilMoisture: Number(row.soilMoisture),
      soilTemperature: Number(row.soilTemperature),
      airTemperature: Number(row.airTemperature),
      airHumidity: Number(row.airHumidity),
      weatherData: this.parseJson<WeatherData>(row.weatherData),
      waterStorageDaily: this.parseJson<WaterStorageDay[]>(row.waterStorageDaily),
      waterRiskLevel: row.waterRiskLevel as IrrigationDecisionRecord['waterRiskLevel'],
      stressForecastDate: row.stressForecastDate,
      irrigationPlan: this.parseJson<IrrigationEvent[]>(row.irrigationPlan),
      aiDiagnosticCriteria: this.parseJson<AiDiagnosticCriterion[]>(row.aiDiagnosticCriteria),
      aiDiagnosticSummary: row.aiDiagnosticSummary ?? undefined,
      aiChatMessages: this.parseJson<AiChatMessage[]>(row.aiChatMessages),
      status: DECISION_STATUSES.includes(row.status as DecisionStatus)
        ? (row.status as DecisionStatus)
        : 'pending',
      executionRecords: this.parseJson<ExecutionRecord[]>(row.executionRecords) ?? [],
      adjustedPlan: row.adjustedPlan
        ? this.parseJson<IrrigationEvent[]>(row.adjustedPlan)
        : undefined,
      aiModel: row.aiModel ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private parseJson<T>(value: unknown): T {
    if (typeof value === 'string') {
      return JSON.parse(value) as T;
    }
    return value as T;
  }
}
