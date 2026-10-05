import { Brain, CloudSun, FlaskConical, Info, Scale } from 'lucide-react';

import type {
  FarmWithLatest,
  IrrigationDecisionRecord,
  WeatherDayData,
} from '@shared/api.interface';
import { formatDateTime, TECH_ROUTE_TEXT } from '@shared/decisionMeta';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DecisionResultBasisProps {
  decision: IrrigationDecisionRecord;
  farm: FarmWithLatest | null;
  hasHistory: boolean;
}

/**
 * 结果区第 2 段:判断依据。
 * 当前水分、24h 预测水分、管理阈值、天气影响、预测目标时间、结果更新时间,
 * 并分栏标注 FAO-56 规则引擎与 AI 诊断判据。
 */
export function DecisionResultBasis({ decision, farm, hasHistory }: DecisionResultBasisProps) {
  // storage 为 mm(根深 1000mm),除以 10 换算为 %
  const daily = decision.waterStorageDaily;
  const predicted24h =
    daily.length > 0 ? (Number(daily[0].storage) / 10).toFixed(1) : '-';

  const weather = decision.weatherData.daily;
  const totalRain = weather.reduce((s: number, d: WeatherDayData) => s + d.rainfall, 0);
  const maxTemp = Math.max(...weather.map((d: WeatherDayData) => d.temperatureMax));
  const lastDay = weather[weather.length - 1]?.date ?? '-';

  const aiCount = decision.aiDiagnosticCriteria?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="h-5 w-5 text-emerald-600" />
          判断依据
        </CardTitle>
        <CardDescription>{TECH_ROUTE_TEXT}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-emerald-50 p-3">
            <div className="text-xs text-emerald-700">当前土壤水分</div>
            <div className="mt-1 text-lg font-semibold text-emerald-900">
              {decision.soilMoisture} %
            </div>
          </div>
          <div className="rounded-lg bg-sky-50 p-3">
            <div className="text-xs text-sky-700">24 小时后预测水分</div>
            <div className="mt-1 text-lg font-semibold text-sky-900">{predicted24h} %</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-xs text-amber-700">预测目标时间</div>
            <div className="mt-1 text-sm font-semibold text-amber-900">
              {decision.stressForecastDate ?? `未来 7 天(至 ${lastDay})`}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <div className="text-xs text-zinc-600">结果更新时间</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900">
              {formatDateTime(decision.createdAt)}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <CloudSun className="h-4 w-4" />
            天气影响
          </div>
          <p className="mt-1 text-xs text-gray-700">
            未来 7 天累计降雨 {totalRain.toFixed(1)} mm,最高气温 {maxTemp}°C
            {totalRain > 0
              ? ';降雨将部分补充土壤水分'
              : ';无明显降雨,土壤水分主要靠灌溉补充'}
          </p>
        </div>

        {farm && (
          <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <FlaskConical className="h-4 w-4" />
              采用的管理阈值
            </div>
            <p className="mt-1 text-xs text-gray-700">
              田间持水量 {farm.fieldCapacity}% / 胁迫阈值 {farm.stressThreshold}% /
              萎蔫点 {farm.wiltingPoint}%;灌溉目标为田间持水量的 80%
            </p>
          </div>
        )}

        {!hasHistory && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>该农田暂无历史决策记录，暂无可用的历史参照</span>
          </div>
        )}

        <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <Brain className="h-4 w-4" />
            AI 诊断判据(辅助修正)
          </div>
          {aiCount > 0 ? (
            <>
              <p className="mt-1 text-xs text-emerald-800/80">
                模型:{decision.aiModel ?? '未知'} · 共 {aiCount} 项判据
                {decision.aiDiagnosticSummary ? ` · ${decision.aiDiagnosticSummary}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {decision.aiDiagnosticCriteria?.map((c, idx: number) => (
                  <Badge key={idx} variant="outline" className="bg-white">
                    {c.label}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs text-emerald-800/70">
              本次未使用 AI 判据，方案由 FAO-56 规则引擎独立计算
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
