import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { count, desc, eq } from 'drizzle-orm';

import type {
  CreateFarmRequest,
  Farm,
  FarmLatestDecision,
  FarmListResponse,
  FarmWithLatest,
  UpdateFarmRequest,
  WaterRiskLevel,
} from '@shared/api.interface';
import type { DecisionStatus } from '@shared/decisionMeta';
import { farm, irrigationDecision } from '@server/database/schema';

// 服务器时区为 Asia/Shanghai，直接按本地时间格式化
function getLocalDate(d: Date): string {
  const year: number = d.getFullYear();
  const month: string = String(d.getMonth() + 1).padStart(2, '0');
  const day: string = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable()
export class FarmService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private toFarm(row: typeof farm.$inferSelect): Farm {
    return {
      id: row.id,
      name: row.name,
      longitude: Number(row.longitude),
      latitude: Number(row.latitude),
      cropType: row.cropType,
      sowingDate: String(row.sowingDate),
      soilType: row.soilType,
      area: Number(row.area),
      irrigationMethod: row.irrigationMethod,
      fieldCapacity: Number(row.fieldCapacity),
      wiltingPoint: Number(row.wiltingPoint),
      stressThreshold: Number(row.stressThreshold),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(page: number, pageSize: number): Promise<FarmListResponse> {
    const offset = (page - 1) * pageSize;

    // 每田最近一次决策摘要(selectDistinctOn 要求 orderBy 首列为去重列)
    const latestDecision = this.db
      .selectDistinctOn([irrigationDecision.farmId], {
        farmId: irrigationDecision.farmId,
        id: irrigationDecision.id,
        soilMoisture: irrigationDecision.soilMoisture,
        waterRiskLevel: irrigationDecision.waterRiskLevel,
        stressForecastDate: irrigationDecision.stressForecastDate,
        status: irrigationDecision.status,
        createdAt: irrigationDecision.createdAt,
      })
      .from(irrigationDecision)
      .orderBy(irrigationDecision.farmId, desc(irrigationDecision.createdAt))
      .as('latest_decision');

    const [rows, countResult] = await Promise.all([
      this.db
        .select({
          farm: farm,
          latest: {
            id: latestDecision.id,
            soilMoisture: latestDecision.soilMoisture,
            waterRiskLevel: latestDecision.waterRiskLevel,
            stressForecastDate: latestDecision.stressForecastDate,
            status: latestDecision.status,
            createdAt: latestDecision.createdAt,
          },
        })
        .from(farm)
        .leftJoin(latestDecision, eq(farm.id, latestDecision.farmId))
        .orderBy(desc(farm.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ count: count() }).from(farm),
    ]);

    const items: FarmWithLatest[] = rows.map((row) => {
      const base = this.toFarm(row.farm);
      const latest = row.latest?.id ? row.latest : null;
      const latestDecisionData: FarmLatestDecision | null = latest
        ? {
            id: latest.id,
            soilMoisture: Number(latest.soilMoisture),
            waterRiskLevel: latest.waterRiskLevel as WaterRiskLevel,
            stressForecastDate: latest.stressForecastDate,
            status: latest.status as DecisionStatus,
            createdAt: latest.createdAt.toISOString(),
          }
        : null;
      return { ...base, latestDecision: latestDecisionData };
    });
    const total: number = countResult[0]?.count ?? 0;

    return { items, total };
  }

  async getById(id: string): Promise<Farm> {
    const rows: typeof farm.$inferSelect[] = await this.db
      .select()
      .from(farm)
      .where(eq(farm.id, id))
      .limit(1);

    const row: typeof farm.$inferSelect | undefined = rows[0];
    if (!row) {
      throw new NotFoundException('农田不存在');
    }

    return this.toFarm(row);
  }

  async create(dto: CreateFarmRequest): Promise<Farm> {
    const inserted: typeof farm.$inferSelect[] = await this.db
      .insert(farm)
      .values({
        name: dto.name,
        longitude: String(dto.longitude),
        latitude: String(dto.latitude),
        cropType: dto.cropType,
        // 表单未填播种日期时兜底为当天，避免空字符串导致 PostgreSQL date 类型报错
        sowingDate: dto.sowingDate?.trim()
          ? dto.sowingDate
          : getLocalDate(new Date()),
        soilType: dto.soilType,
        area: String(dto.area),
        irrigationMethod: dto.irrigationMethod,
        fieldCapacity:
          dto.fieldCapacity !== undefined
            ? String(dto.fieldCapacity)
            : undefined,
        wiltingPoint:
          dto.wiltingPoint !== undefined ? String(dto.wiltingPoint) : undefined,
        stressThreshold:
          dto.stressThreshold !== undefined
            ? String(dto.stressThreshold)
            : undefined,
      })
      .returning();

    return this.toFarm(inserted[0]);
  }

  async update(id: string, dto: UpdateFarmRequest): Promise<Farm> {
    const patch: Partial<typeof farm.$inferInsert> = {};

    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.longitude !== undefined) patch.longitude = String(dto.longitude);
    if (dto.latitude !== undefined) patch.latitude = String(dto.latitude);
    if (dto.cropType !== undefined) patch.cropType = dto.cropType;
    if (dto.sowingDate !== undefined)
      patch.sowingDate = dto.sowingDate?.trim() || undefined;
    if (dto.soilType !== undefined) patch.soilType = dto.soilType;
    if (dto.area !== undefined) patch.area = String(dto.area);
    if (dto.irrigationMethod !== undefined)
      patch.irrigationMethod = dto.irrigationMethod;
    if (dto.fieldCapacity !== undefined)
      patch.fieldCapacity = String(dto.fieldCapacity);
    if (dto.wiltingPoint !== undefined)
      patch.wiltingPoint = String(dto.wiltingPoint);
    if (dto.stressThreshold !== undefined)
      patch.stressThreshold = String(dto.stressThreshold);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated: typeof farm.$inferSelect[] = await this.db
      .update(farm)
      .set(patch)
      .where(eq(farm.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('农田不存在');
    }

    return this.toFarm(updated[0]);
  }

  async remove(id: string): Promise<{ id: string }> {
    const deleted: { id: string }[] = await this.db
      .delete(farm)
      .where(eq(farm.id, id))
      .returning({ id: farm.id });

    if (deleted.length === 0) {
      throw new NotFoundException('农田不存在');
    }

    return { id: deleted[0].id };
  }
}
