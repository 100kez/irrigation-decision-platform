import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Droplets,
  Gauge,
  ListChecks,
  Plus,
  Sparkles,
  Sprout,
} from 'lucide-react';

import type { DashboardResponse, FarmStatusCard, PendingActionItem, RecentDecisionItem } from '@shared/api.interface';
import {
  DECISION_STATUS_META,
  FUTURE_RISK_META,
  formatDateTime,
  MOISTURE_STATUS_META,
  TECH_ROUTE_TEXT,
  WATER_RISK_META,
} from '@shared/decisionMeta';

import { irrigationApi } from '@/api/irrigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  futureRiskBadgeClass,
  moistureBadgeClass,
  riskBadgeClass,
  statusBadgeClass,
} from '@/lib/decision-visual';

type RangeKey = 'all' | '7d' | '30d';

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>('all');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await irrigationApi.getDashboard(range);
        if (!cancelled) setData(res);
      } catch (err: unknown) {
        if (cancelled) return;
        logger.error('加载首页统计数据失败', err);
        toast.error('加载数据失败,请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const stats = data?.stats;
  const statCards = [
    {
      label: '农田总数',
      value: loading ? '--' : (stats?.farmCount ?? 0),
      unit: '块',
      icon: Sprout,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: '决策次数',
      value: loading ? '--' : (stats?.decisionCount ?? 0),
      unit: '次',
      icon: Gauge,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      label: '建议灌溉水量',
      value: loading ? '--' : (stats?.suggestedM3 ?? 0).toLocaleString(),
      unit: 'm³',
      icon: Droplets,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      label: '实际执行水量',
      value: loading ? '--' : (stats?.executedM3 ?? 0).toLocaleString(),
      unit: 'm³',
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '风险农田',
      value: loading ? '--' : (stats?.riskFarmCount ?? 0),
      unit: '块',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  const noDataFarms =
    data?.farmStatuses.filter((f: FarmStatusCard) => !f.hasData) ?? [];
  const withDataFarms =
    data?.farmStatuses.filter((f: FarmStatusCard) => f.hasData) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">欢迎使用智灌云</h1>
          <p className="text-sm text-muted-foreground">{TECH_ROUTE_TEXT}</p>
        </div>
        <div className="w-36">
          <Select value={range} onValueChange={(v: string) => setRange(v as RangeKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        data-ai-section-type="card-stat"
      >
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border shadow-sm">
              <CardContent className="flex items-start justify-between p-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </span>
                    <span className="text-xs text-muted-foreground">{stat.unit}</span>
                  </div>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        口径:决策次数与建议/执行水量按生成时间统计(随上方时间范围变化);风险农田数 = 最新决策为干旱或胁迫的农田(全时段)
      </p>

      {/* 待处理建议(优先展示) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ListChecks className="h-4 w-4 text-amber-500" />
            待处理建议
            {data && data.stats.pendingCount > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {data.stats.pendingCount} 条
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-16 items-center justify-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : !data || data.pendingActions.length === 0 ? (
            <div className="flex min-h-16 items-center justify-center text-sm text-muted-foreground">
              暂无待处理的灌溉建议,农田状态良好
            </div>
          ) : (
            <div className="space-y-2">
              {data.pendingActions.map((item: PendingActionItem) => {
                const risk = WATER_RISK_META[item.waterRiskLevel];
                return (
                  <button
                    key={item.id}
                    className="block w-full rounded-lg border border-gray-100 p-3 text-left transition-colors hover:border-amber-200 hover:bg-amber-50/40"
                    onClick={() => navigate(`/decision?decisionId=${item.id}`)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {item.farmName}
                      </span>
                      <Badge variant="outline" className={riskBadgeClass(item.waterRiskLevel)}>
                        {risk.label}
                      </Badge>
                      <Badge variant="outline" className={statusBadgeClass(item.status)}>
                        {DECISION_STATUS_META[item.status].label}
                      </Badge>
                      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.eventCount > 0
                        ? `建议 ${item.eventCount} 次灌溉,合计 ${item.suggestedMm.toFixed(1)} mm(约 ${item.suggestedM3.toFixed(1)} m³)`
                        : '当前方案无需灌溉'}
                      {item.stressForecastDate && ` · 预计 ${item.stressForecastDate} 发生胁迫`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 农田状态概览 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">农田状态概览</CardTitle>
          <span className="text-xs text-muted-foreground">
            {withDataFarms.length} 块有数据 · {noDataFarms.length} 块数据不足
          </span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : !data || data.farmStatuses.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
              暂无农田,请先在农田管理中添加
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[...withDataFarms, ...noDataFarms].map((f: FarmStatusCard) => (
                <button
                  key={f.farmId}
                  className="block rounded-lg border border-gray-100 p-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/30"
                  onClick={() => navigate(`/decision?farmId=${f.farmId}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {f.name}
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-1.5">
                      <Badge variant="outline" className={moistureBadgeClass(f.moistureStatus)}>
                        {MOISTURE_STATUS_META[f.moistureStatus].label}
                      </Badge>
                      <Badge variant="outline" className={futureRiskBadgeClass(f.futureRisk)}>
                        缺水风险:{FUTURE_RISK_META[f.futureRisk].label}
                      </Badge>
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">当前水分</div>
                      <div className="font-medium text-foreground">
                        {f.currentMoisture !== null ? `${f.currentMoisture}%` : '--'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">24h 预测</div>
                      <div className="font-medium text-foreground">
                        {f.predicted24hMoisture !== null ? `${f.predicted24hMoisture}%` : '--'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">最近更新</div>
                      <div className="font-medium text-foreground">
                        {f.lastUpdatedAt ? formatDateTime(f.lastUpdatedAt).slice(5, 16) : '--'}
                      </div>
                    </div>
                  </div>
                  {!f.hasData && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      尚未接入观测数据,点击生成首次决策
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最近决策 + 快捷操作/使用提示 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">最近决策记录</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={() => navigate('/history')}
            >
              查看全部
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                加载中...
              </div>
            ) : !data || data.recentDecisions.length === 0 ? (
              <div className="flex min-h-32 flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <CalendarClock className="h-6 w-6 text-gray-400" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">暂无决策记录</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  生成第一次灌溉决策后,记录将显示在这里
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentDecisions.map((rec: RecentDecisionItem) => (
                  <button
                    key={rec.id}
                    className="block w-full rounded-lg border border-gray-100 p-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/30"
                    onClick={() => navigate(`/decision?decisionId=${rec.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {rec.farmName}
                          </span>
                          <Badge variant="outline" className={riskBadgeClass(rec.waterRiskLevel)}>
                            {WATER_RISK_META[rec.waterRiskLevel].label}
                          </Badge>
                          <Badge variant="outline" className={statusBadgeClass(rec.status)}>
                            {DECISION_STATUS_META[rec.status].label}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDateTime(rec.createdAt)}</span>
                          <span className="text-emerald-700">
                            建议灌溉 {rec.suggestedMm.toFixed(1)} mm
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => navigate('/farms')}
              >
                <Plus className="h-4 w-4" />
                新增农田
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                onClick={() => navigate('/decision')}
              >
                <Sparkles className="h-4 w-4" />
                生成灌溉决策
              </Button>
            </CardContent>
          </Card>

          <Collapsible>
            <Card>
              <CardHeader className="pb-2">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full justify-between px-2 text-sm font-semibold text-foreground"
                  >
                    使用提示
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0 text-xs leading-relaxed text-muted-foreground">
                  <p>1. 先在「农田管理」中添加您的农田信息</p>
                  <p>2. 前往「灌溉决策」录入或回填田间观测数据</p>
                  <p>3. 系统基于 FAO-56 蒸散模型生成 7 天灌溉方案</p>
                  <p>4. 采纳方案后,实际灌溉请在方案中记录执行</p>
                  <p>5. 在「历史记录」中回顾与复盘历次决策</p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
