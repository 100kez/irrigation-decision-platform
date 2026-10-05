/**
 * 决策元数据的视觉层:为 shared/decisionMeta 的枚举挂接配色与图标。
 * 全站统一从本文件取徽章样式,不再在页面内重复定义。
 */
import {
  AlertTriangle,
  CheckCircle,
  Droplet,
  Droplets,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { WaterRiskLevel } from '@shared/api.interface';
import type { DecisionStatus, MoistureStatus, FutureRiskLevel } from '@shared/decisionMeta';

// ============ 水分风险等级(计算结果) ============

export const RISK_VISUAL: Record<
  WaterRiskLevel,
  { icon: LucideIcon; badgeClass: string; cardBg: string; cardText: string; cardBorder: string }
> = {
  drought: {
    icon: Droplet,
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    cardBg: 'bg-red-50',
    cardText: 'text-red-700',
    cardBorder: 'border-red-200',
  },
  stress: {
    icon: AlertTriangle,
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    cardBg: 'bg-orange-50',
    cardText: 'text-orange-700',
    cardBorder: 'border-orange-200',
  },
  normal: {
    icon: CheckCircle,
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    cardBg: 'bg-emerald-50',
    cardText: 'text-emerald-700',
    cardBorder: 'border-emerald-200',
  },
  wet: {
    icon: Droplets,
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    cardBg: 'bg-blue-50',
    cardText: 'text-blue-700',
    cardBorder: 'border-blue-200',
  },
  flood: {
    icon: Waves,
    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    cardBg: 'bg-indigo-50',
    cardText: 'text-indigo-700',
    cardBorder: 'border-indigo-200',
  },
};

// ============ 方案状态 ============

export const STATUS_VISUAL: Record<DecisionStatus, { badgeClass: string }> = {
  pending: { badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
  adopted: { badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
  executed: { badgeClass: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' },
  superseded: { badgeClass: 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through decoration-zinc-400' },
};

// ============ 当前水分状态 ============

export const MOISTURE_VISUAL: Record<
  MoistureStatus,
  { badgeClass: string; dotClass: string }
> = {
  wet: {
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  suitable: {
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  dry: {
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    dotClass: 'bg-orange-500',
  },
  stress: {
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    dotClass: 'bg-red-500',
  },
  no_data: {
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
    dotClass: 'bg-gray-400',
  },
};

// ============ 未来缺水风险 ============

export const FUTURE_RISK_VISUAL: Record<
  FutureRiskLevel,
  { badgeClass: string }
> = {
  high: { badgeClass: 'bg-red-100 text-red-700 border-red-200' },
  medium: { badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  no_data: { badgeClass: 'bg-gray-100 text-gray-500 border-gray-200' },
};

// ============ 快捷取样式函数 ============

export function riskBadgeClass(level: WaterRiskLevel): string {
  return RISK_VISUAL[level].badgeClass;
}

export function statusBadgeClass(status: DecisionStatus): string {
  return STATUS_VISUAL[status].badgeClass;
}

export function moistureBadgeClass(status: MoistureStatus): string {
  return MOISTURE_VISUAL[status].badgeClass;
}

export function futureRiskBadgeClass(risk: FutureRiskLevel): string {
  return FUTURE_RISK_VISUAL[risk].badgeClass;
}
