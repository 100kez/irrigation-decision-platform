/**
 * 全平台统一的决策元数据:状态、等级、映射与派生规则。
 * 前后端共用(零依赖),文案与规则以本文件为唯一来源。
 */
import type { WaterRiskLevel } from './api.interface';

// ============ 方案状态 ============

export type DecisionStatus =
  | 'pending' // 待确认
  | 'adopted' // 已采纳
  | 'executed' // 已执行
  | 'rejected' // 暂不执行
  | 'superseded'; // 已替代

export const DECISION_STATUSES: DecisionStatus[] = [
  'pending',
  'adopted',
  'executed',
  'rejected',
  'superseded',
];

export const DECISION_STATUS_META: Record<
  DecisionStatus,
  { label: string; tone: 'neutral' | 'blue' | 'green' | 'gray' | 'amber' }
> = {
  pending: { label: '待确认', tone: 'amber' },
  adopted: { label: '已采纳', tone: 'blue' },
  executed: { label: '已执行', tone: 'green' },
  rejected: { label: '暂不执行', tone: 'gray' },
  superseded: { label: '已替代', tone: 'neutral' },
};

/** 可以被新方案替代的状态 */
export const SUPERSEDABLE_STATUSES: DecisionStatus[] = ['pending', 'adopted'];

// ============ 当前水分状态 ============

export type MoistureStatus =
  | 'wet' // 偏湿
  | 'suitable' // 适宜
  | 'dry' // 偏干
  | 'stress' // 胁迫
  | 'no_data'; // 数据不足

export const MOISTURE_STATUS_META: Record<
  MoistureStatus,
  { label: string; description: string }
> = {
  wet: { label: '偏湿', description: '土壤水分高于田间持水量，注意排水' },
  suitable: { label: '适宜', description: '土壤水分处于适宜范围，作物生长良好' },
  dry: { label: '偏干', description: '土壤水分低于胁迫阈值，建议近期安排灌溉' },
  stress: { label: '胁迫', description: '土壤水分接近萎蔫点，需立即灌溉' },
  no_data: { label: '数据不足', description: '暂无观测数据，请先生成一次决策' },
};

export interface MoistureThresholds {
  fieldCapacity: number;
  stressThreshold: number;
  wiltingPoint: number;
}

/**
 * 由当前土壤含水率(%)与农田阈值推导水分状态。
 * 划分规则由农业决策模块确定,可在此调整。
 */
export function getMoistureStatus(
  soilMoisture: number | null | undefined,
  thresholds: MoistureThresholds | null | undefined,
): MoistureStatus {
  if (soilMoisture === null || soilMoisture === undefined || !thresholds) {
    return 'no_data';
  }
  if (soilMoisture > thresholds.fieldCapacity) return 'wet';
  if (soilMoisture >= thresholds.stressThreshold) return 'suitable';
  if (soilMoisture >= thresholds.wiltingPoint) return 'dry';
  return 'stress';
}

// ============ 未来缺水风险 ============

export type FutureRiskLevel = 'high' | 'medium' | 'low' | 'no_data';

export const FUTURE_RISK_META: Record<
  FutureRiskLevel,
  { label: string; description: string }
> = {
  high: { label: '高', description: '3 天内预计发生水分胁迫，或当前已处于胁迫' },
  medium: { label: '中', description: '3~7 天内预计发生水分胁迫' },
  low: { label: '低', description: '未来 7 天内无水分胁迫风险' },
  no_data: { label: '数据不足', description: '暂无预测数据' },
};

/**
 * 由最新决策的水分风险等级与预期胁迫日期推导未来缺水风险。
 * 规则可调(由建模与农业决策模块确定);today 用于跨时区一致计算。
 */
export function getFutureRisk(
  waterRiskLevel: WaterRiskLevel | null | undefined,
  stressForecastDate: string | null | undefined,
  today?: Date,
): FutureRiskLevel {
  if (!waterRiskLevel) return 'no_data';
  if (waterRiskLevel === 'drought' || waterRiskLevel === 'stress') return 'high';
  if (!stressForecastDate) return 'low';
  const base = today ? new Date(today) : new Date();
  const target = new Date(`${stressForecastDate}T00:00:00`);
  const todayStart = new Date(base);
  todayStart.setHours(0, 0, 0, 0);
  const days = Math.ceil(
    (target.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 3) return 'high';
  if (days <= 7) return 'medium';
  return 'low';
}

// ============ 水分风险等级(计算结果) ============

export const WATER_RISK_META: Record<
  WaterRiskLevel,
  { label: string; description: string; advice: string }
> = {
  drought: {
    label: '干旱',
    description: '土壤蓄水量极低，作物面临严重水分胁迫',
    advice: '建议立即加大灌溉量，尽快恢复土壤水分至正常水平',
  },
  stress: {
    label: '胁迫',
    description: '土壤蓄水量接近胁迫阈值，作物可能出现缺水症状',
    advice: '建议近期安排灌溉，避免作物进入严重胁迫状态',
  },
  normal: {
    label: '正常',
    description: '土壤蓄水量处于适宜范围，作物生长良好',
    advice: '继续保持当前灌溉节奏，关注天气变化即可',
  },
  wet: {
    label: '偏湿',
    description: '土壤蓄水量偏高，需注意排水防涝',
    advice: '建议减少灌溉量，关注降雨预报，防止土壤过湿',
  },
  flood: {
    label: '渍涝',
    description: '土壤蓄水量接近或超过田间持水量，存在渍涝风险',
    advice: '立即停止灌溉，做好田间排水工作，防止作物根系缺氧',
  },
};

// ============ 生育阶段 ============

export type GrowthStage = 'seedling' | 'development' | 'mid' | 'late';

export const GROWTH_STAGE_LABELS: Record<GrowthStage, string> = {
  seedling: '苗期',
  development: '发育期',
  mid: '中期',
  late: '后期',
};

/** 与 irrigation.service.getCropKc 的分段一致(20/50/90/120 天) */
export function getGrowthStage(sowingDate: string | null | undefined, today?: Date): GrowthStage {
  if (!sowingDate) return 'late';
  const base = today ? new Date(today) : new Date();
  const start = new Date(`${sowingDate.slice(0, 10)}T00:00:00`);
  const days = Math.floor((base.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 20) return 'seedling';
  if (days <= 50) return 'development';
  if (days <= 90) return 'mid';
  return 'late';
}

// ============ 实际执行记录 ============

export interface ExecutionRecord {
  executedAt: string;
  amountMm: number;
  amountM3: number;
  note?: string;
}

// ============ 英文枚举 → 中文兜底映射 ============

export const CROP_TYPE_LABELS: Record<string, string> = {
  maize: '玉米',
  corn: '玉米',
  wheat: '小麦',
  rice: '水稻',
  cotton: '棉花',
  soybean: '大豆',
  tomato: '番茄',
};

export const SOIL_TYPE_LABELS: Record<string, string> = {
  loam: '壤土',
  sand: '砂土',
  clay: '黏土',
  sandy_loam: '砂壤土',
  silty_loam: '粉壤土',
};

export const IRRIGATION_METHOD_LABELS: Record<string, string> = {
  drip: '滴灌',
  sprinkler: '喷灌',
  flood: '漫灌',
  micro: '微灌',
  furrow: '沟灌',
};

/** 未知值回显原值(兼容历史脏数据) */
export function translateEnum(value: string | null | undefined, map: Record<string, string>): string {
  if (!value) return '';
  return map[value] ?? value;
}

// ============ 时间格式化 ============

/** 全平台统一时间格式:YYYY-MM-DD HH:mm(上海时区) */
export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 全平台统一日期格式:YYYY-MM-DD */
export function formatDate(iso: string | Date | null | undefined): string {
  return formatDateTime(iso).slice(0, 10);
}

// ============ 口径常量 ============

/** 技术路线统一表述 */
export const TECH_ROUTE_TEXT =
  '灌溉计划由 FAO-56 蒸散规则引擎(7 天水量平衡)计算，AI 诊断判据辅助修正风险与计划';
