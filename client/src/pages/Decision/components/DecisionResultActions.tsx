import { CalendarClock, CircleCheck, Droplets, Lightbulb } from 'lucide-react';

import type { IrrigationDecisionRecord, IrrigationEvent } from '@shared/api.interface';
import { formatDate, WATER_RISK_META } from '@shared/decisionMeta';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { riskBadgeClass } from '@/lib/decision-visual';

interface DecisionResultActionsProps {
  decision: IrrigationDecisionRecord;
}

/**
 * 结果区第 1 段:建议动作。
 * 直接回答 是否需要灌溉 / 何时浇 / 浇多少,暂无需求时明确显示暂不灌溉。
 */
export function DecisionResultActions({ decision }: DecisionResultActionsProps) {
  const plan: IrrigationEvent[] = decision.adjustedPlan ?? decision.irrigationPlan;
  const needIrrigation = plan.length > 0;
  const firstEvent = plan[0];
  const totalMm = plan.reduce((s: number, e: IrrigationEvent) => s + e.amountMm, 0);
  const totalM3 = plan.reduce((s: number, e: IrrigationEvent) => s + e.amountM3, 0);
  const riskMeta = WATER_RISK_META[decision.waterRiskLevel];

  const timeWindow =
    plan.length > 1
      ? `${formatDate(firstEvent.date)} ~ ${formatDate(plan[plan.length - 1].date)}`
      : formatDate(firstEvent.date);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          建议动作
        </CardTitle>
        <CardDescription>
          基于当前观测与未来 7 天天气预测的灌溉建议
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {needIrrigation ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 bg-emerald-50 border-emerald-200 text-emerald-700">
                <Droplets className="h-3.5 w-3.5" />
                建议灌溉
              </Badge>
              <Badge variant="outline" className={riskBadgeClass(decision.waterRiskLevel)}>
                水分风险:{riskMeta.label}
              </Badge>
              {decision.stressForecastDate && (
                <span className="text-xs text-muted-foreground">
                  预计 {formatDate(decision.stressForecastDate)} 发生胁迫
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-emerald-50 p-3">
                <div className="flex items-center gap-1 text-xs text-emerald-700">
                  <CalendarClock className="h-3.5 w-3.5" />
                  建议时间窗口
                </div>
                <div className="mt-1 font-semibold text-emerald-900">{timeWindow}</div>
                <div className="mt-0.5 text-xs text-emerald-700/70">共 {plan.length} 次灌溉</div>
              </div>
              <div className="rounded-lg bg-sky-50 p-3">
                <div className="text-xs text-sky-700">单次建议水量</div>
                <div className="mt-1 font-semibold text-sky-900">
                  {firstEvent.amountMm.toFixed(1)} mm
                </div>
                <div className="mt-0.5 text-xs text-sky-700/70">
                  约 {firstEvent.amountM3.toFixed(1)} m³
                </div>
              </div>
              <div className="rounded-lg bg-teal-50 p-3">
                <div className="text-xs text-teal-700">本轮合计</div>
                <div className="mt-1 font-semibold text-teal-900">{totalMm.toFixed(1)} mm</div>
                <div className="mt-0.5 text-xs text-teal-700/70">约 {totalM3.toFixed(1)} m³</div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">{riskMeta.advice}</p>
          </>
        ) : (
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 px-4 py-3">
            <CircleCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div>
              <div className="font-medium text-emerald-900">暂不灌溉</div>
              <p className="mt-0.5 text-sm text-emerald-700/80">
                未来 7 天内土壤水分保持充足，无需补充灌溉。{riskMeta.advice}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
