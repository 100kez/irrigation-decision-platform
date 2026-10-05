import type {
  DecisionStatus,
  ExecutionRecord,
  FutureRiskLevel,
  MoistureStatus,
} from './decisionMeta';

export interface Farm {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  cropType: string;
  sowingDate: string;
  soilType: string;
  area: number;
  irrigationMethod: string;
  fieldCapacity: number;
  wiltingPoint: number;
  stressThreshold: number;
  createdAt: string;
}

export interface CreateFarmRequest {
  name: string;
  longitude: number;
  latitude: number;
  cropType: string;
  sowingDate?: string;
  soilType: string;
  area: number;
  irrigationMethod: string;
  fieldCapacity?: number;
  wiltingPoint?: number;
  stressThreshold?: number;
}

export interface UpdateFarmRequest extends Partial<CreateFarmRequest> {}

export interface FarmListResponse {
  items: FarmWithLatest[];
  total: number;
}

/** 农田列表附带的最近一次决策摘要 */
export interface FarmLatestDecision {
  id: string;
  soilMoisture: number;
  waterRiskLevel: WaterRiskLevel;
  stressForecastDate: string | null;
  createdAt: string;
  status: DecisionStatus;
}

export interface FarmWithLatest extends Farm {
  latestDecision: FarmLatestDecision | null;
}

export interface WeatherDayData {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  temperatureAvg: number;
  humidity: number;
  rainfall: number;
  solarRadiation: number;
  windSpeed: number;
}

export interface WeatherData {
  daily: WeatherDayData[];
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
  };
}

export interface WaterStorageDay {
  date: string;
  et0: number;
  etc: number;
  rainfall: number;
  storage: number;
  storageChange: number;
}

export type WaterRiskLevel = 'drought' | 'stress' | 'normal' | 'wet' | 'flood';

export interface IrrigationEvent {
  date: string;
  amountMm: number;
  amountM3: number;
  reason: string;
}

export interface IrrigationDecisionResult {
  waterStorageDaily: WaterStorageDay[];
  totalWaterStorageChange: number;
  finalStorage: number;
  waterRiskLevel: WaterRiskLevel;
  stressForecastDate: string | null;
  irrigationPlan: IrrigationEvent[];
  totalIrrigationMm: number;
  totalIrrigationM3: number;
}

export interface CreateDecisionRequest {
  farmId: string;
  soilMoisture: number;
  soilTemperature: number;
  airTemperature: number;
  airHumidity: number;
}

export interface IrrigationDecisionRecord {
  id: string;
  farmId: string;
  farmName: string;
  soilMoisture: number;
  soilTemperature: number;
  airTemperature: number;
  airHumidity: number;
  weatherData: WeatherData;
  waterStorageDaily: WaterStorageDay[];
  waterRiskLevel: WaterRiskLevel;
  stressForecastDate: string | null;
  irrigationPlan: IrrigationEvent[];
  aiDiagnosticCriteria?: AiDiagnosticCriterion[];
  aiDiagnosticSummary?: string;
  aiChatMessages?: AiChatMessage[];
  status: DecisionStatus;
  executionRecords: ExecutionRecord[];
  adjustedPlan?: IrrigationEvent[];
  aiModel?: string;
  createdAt: string;
}

export interface DecisionListResponse {
  items: IrrigationDecisionRecord[];
  total: number;
}

// ============ 状态流转 / 执行 / 调整 ============

export interface UpdateDecisionStatusRequest {
  status: 'adopted' | 'rejected';
}

export interface CreateExecutionRequest {
  executedAt: string;
  amountMm: number;
  amountM3?: number;
  note?: string;
}

export interface UpdatePlanRequest {
  events: IrrigationEvent[];
}

export interface ListDecisionsQuery {
  page?: number;
  pageSize?: number;
  farmId?: string;
  status?: DecisionStatus;
  sort?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

// ============ 首页概览 ============

export interface DashboardStats {
  farmCount: number;
  decisionCount: number;
  suggestedM3: number;
  suggestedEvents: number;
  executedM3: number;
  executedEvents: number;
  riskFarmCount: number;
  pendingCount: number;
}

export interface FarmStatusCard {
  farmId: string;
  name: string;
  area: number;
  cropType: string;
  currentMoisture: number | null;
  moistureStatus: MoistureStatus;
  predicted24hMoisture: number | null;
  futureRisk: FutureRiskLevel;
  latestDecisionId: string | null;
  latestDecisionStatus: DecisionStatus | null;
  lastUpdatedAt: string | null;
  hasData: boolean;
}

export interface PendingActionItem {
  id: string;
  farmId: string;
  farmName: string;
  waterRiskLevel: WaterRiskLevel;
  stressForecastDate: string | null;
  status: DecisionStatus;
  createdAt: string;
  suggestedMm: number;
  suggestedM3: number;
  eventCount: number;
}

export interface RecentDecisionItem {
  id: string;
  farmId: string;
  farmName: string;
  waterRiskLevel: WaterRiskLevel;
  status: DecisionStatus;
  createdAt: string;
  suggestedMm: number;
}

export interface DashboardResponse {
  range: 'all' | '7d' | '30d';
  stats: DashboardStats;
  farmStatuses: FarmStatusCard[];
  pendingActions: PendingActionItem[];
  recentDecisions: RecentDecisionItem[];
}

export type AiDiagnosticCriterionType =
  | 'wilt' // 萎蔫/卷曲 → 提高水分风险，提前灌溉
  | 'root_rot' // 根部病害/烂根 → 减少漫灌，考虑排水
  | 'heat_burn' // 叶片灼伤/高温危害 → 避开高温时段，增加频次
  | 'pest' // 病虫害
  | 'nutrient' // 营养缺素
  | 'normal'; // 长势良好，维持原决策

export interface AiDiagnosticCriterion {
  type: AiDiagnosticCriterionType;
  label: string;
  description: string;
  impact: string;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrls?: string[];
}

export interface AiDiagnosticChatRequest {
  messages: AiChatMessage[];
  cropType?: string;
}

export interface AiDiagnosticChatResponse {
  reply: string;
  criteria: AiDiagnosticCriterion[];
  diagnosticSummary?: string;
}

export interface CreateDecisionWithAiRequest extends CreateDecisionRequest {
  aiDiagnosticContext?: {
    chatSummary: string;
    criteria: AiDiagnosticCriterion[];
    messages: AiChatMessage[];
  };
}
