/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { date, foreignKey, index, jsonb, numeric, pgTable, text, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const irrigationDecision = pgTable("irrigation_decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  farmId: uuid("farm_id").notNull(),
  soilMoisture: numeric("soil_moisture").notNull(),
  soilTemperature: numeric("soil_temperature").notNull(),
  airTemperature: numeric("air_temperature").notNull(),
  airHumidity: numeric("air_humidity").notNull(),
  weatherData: jsonb("weather_data").notNull(),
  waterStorageDaily: jsonb("water_storage_daily").notNull(),
  waterRiskLevel: varchar("water_risk_level", { length: 20 }).notNull(),
  stressForecastDate: date("stress_forecast_date"),
  irrigationPlan: jsonb("irrigation_plan").notNull(),
  /**
   * @type { type: string, label: string, description: string, impact: string }[]
   */
  aiDiagnosticCriteria: jsonb("ai_diagnostic_criteria").default('[]'),
  aiDiagnosticSummary: text("ai_diagnostic_summary"),
  /**
   * @type { role: string, content: string, imageUrls?: string[] }[]
   */
  aiChatMessages: jsonb("ai_chat_messages").default('[]'),
  // 方案状态: pending 待确认 / adopted 已采纳 / executed 已执行 / rejected 暂不执行 / superseded 已替代
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  /**
   * @type { executedAt: string, amountMm: number, amountM3: number, note?: string }[]
   */
  executionRecords: jsonb("execution_records").notNull().default('[]'),
  /**
   * @type { date: string, amountMm: number, amountM3: number, reason: string }[]
   */
  adjustedPlan: jsonb("adjusted_plan"),
  aiModel: varchar("ai_model", { length: 50 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_irrigation_decision_farm_id").on(table.farmId),
  index("idx_irrigation_decision_created_at").on(table.createdAt),
  foreignKey({
    columns: [table.farmId],
    foreignColumns: [farm.id],
    name: "irrigation_decision_farm_id_fkey",
  }).onDelete("cascade"),
]);

export const farm = pgTable("farm", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  longitude: numeric("longitude").notNull(),
  latitude: numeric("latitude").notNull(),
  cropType: varchar("crop_type", { length: 50 }).notNull(),
  sowingDate: date("sowing_date").notNull(),
  soilType: varchar("soil_type", { length: 50 }).notNull(),
  area: numeric("area").notNull(),
  irrigationMethod: varchar("irrigation_method", { length: 50 }).notNull(),
  fieldCapacity: numeric("field_capacity").notNull().default('30.0'),
  wiltingPoint: numeric("wilting_point").notNull().default('10.0'),
  stressThreshold: numeric("stress_threshold").notNull().default('18.0'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
});

// table aliases
export const farmTable = farm;
export const irrigationDecisionTable = irrigationDecision;
