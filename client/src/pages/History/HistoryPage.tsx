import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import {
  History,
  Droplets,
  Thermometer,
  Wind,
  CloudRain,
  Sun,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  MapPin,
  CheckCircle2,
  FlaskConical,
  PencilRuler,
} from 'lucide-react';

import type {
  DecisionListResponse,
  Farm,
  IrrigationDecisionRecord,
  IrrigationEvent,
  ListDecisionsQuery,
} from '@shared/api.interface';
import {
  DECISION_STATUSES,
  DECISION_STATUS_META,
  formatDateTime,
  WATER_RISK_META,
  type DecisionStatus,
  type ExecutionRecord,
} from '@shared/decisionMeta';
import { irrigationApi } from '@/api/irrigation';
import { farmApi } from '@/api/farm';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { riskBadgeClass, statusBadgeClass } from '@/lib/decision-visual';

// ─── 列表行数据口径 ────────────────────────────────────────────────────────
function effectivePlan(record: IrrigationDecisionRecord): IrrigationEvent[] {
  return record.adjustedPlan ?? record.irrigationPlan;
}

function plannedMm(record: IrrigationDecisionRecord): number {
  return effectivePlan(record).reduce((s: number, e: IrrigationEvent) => s + e.amountMm, 0);
}

function executedSummary(record: IrrigationDecisionRecord): { count: number; mm: number; m3: number } {
  const records = record.executionRecords ?? [];
  return {
    count: records.length,
    mm: records.reduce((s: number, r: ExecutionRecord) => s + r.amountMm, 0),
    m3: records.reduce((s: number, r: ExecutionRecord) => s + r.amountM3, 0),
  };
}

const HistoryPage = () => {
  const [searchParams] = useSearchParams();

  const [farmId, setFarmId] = useState<string>(searchParams.get('farmId') ?? 'all');
  const [status, setStatus] = useState<string>(searchParams.get('status') ?? 'all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [items, setItems] = useState<IrrigationDecisionRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IrrigationDecisionRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmsLoading, setFarmsLoading] = useState<boolean>(false);

  // 加载农田列表
  useEffect(() => {
    let cancelled = false;
    setFarmsLoading(true);
    farmApi
      .listFarms({ page: 1, pageSize: 100 })
      .then((res) => {
        if (cancelled) return;
        setFarms(res.items);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.error('加载农田列表失败', err);
        toast.error('加载农田列表失败');
      })
      .finally(() => {
        if (!cancelled) setFarmsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  // 加载列表(修复:sort 真正传给后端,并带上状态与日期范围筛选)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: ListDecisionsQuery = {
      page,
      pageSize,
      sort: sortOrder,
    };
    if (farmId && farmId !== 'all') params.farmId = farmId;
    if (status && status !== 'all') params.status = status as DecisionStatus;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    irrigationApi
      .listDecisions(params)
      .then((res: DecisionListResponse) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.error('加载历史决策记录失败', err);
        toast.error('加载失败，请稍后重试');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId, status, sortOrder, dateFrom, dateTo, page, pageSize]);

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [farmId, status, sortOrder, dateFrom, dateTo]);

  // 加载详情
  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    irrigationApi
      .getDecision(detailId)
      .then((rec: IrrigationDecisionRecord) => {
        if (cancelled) return;
        setDetail(rec);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.error('加载决策详情失败', err);
        toast.error('加载详情失败');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  // 最新有效方案:同一农田内生成时间最新且未被替代的记录
  const latestValidIds = useMemo(() => {
    const latestByFarm = new Map<string, IrrigationDecisionRecord>();
    for (const rec of items) {
      const prev = latestByFarm.get(rec.farmId);
      if (!prev || new Date(rec.createdAt) > new Date(prev.createdAt)) {
        latestByFarm.set(rec.farmId, rec);
      }
    }
    const ids = new Set<string>();
    for (const rec of latestByFarm.values()) {
      if (rec.status !== 'superseded') ids.add(rec.id);
    }
    return ids;
  }, [items]);

  const weatherSummary = useMemo(() => {
    if (!detail) return null;
    const daily = detail.weatherData.daily;
    const tempMax = Math.max(...daily.map((d) => d.temperatureMax));
    const tempMin = Math.min(...daily.map((d) => d.temperatureMin));
    const totalRainfall = daily.reduce((sum: number, d) => sum + d.rainfall, 0);
    return { tempMax, tempMin, totalRainfall };
  }, [detail]);

  const handlePrevPage = () => {
    setPage((p: number) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setPage((p: number) => Math.min(totalPages, p + 1));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">历史记录</h1>
        <p className="text-sm text-muted-foreground">
          查看和回顾历史灌溉决策记录,追踪方案的采纳与执行情况
        </p>
      </div>

      {/* 筛选区 */}
      <Card className="border-green-100 bg-green-50/30">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">农田筛选</Label>
            <Select value={farmId} onValueChange={setFarmId}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="选择农田" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部农田</SelectItem>
                {farmsLoading && farms.length === 0 ? (
                  <SelectItem value="__loading__" disabled>
                    加载中...
                  </SelectItem>
                ) : (
                  farms.map((farm: Farm) => (
                    <SelectItem key={farm.id} value={farm.id}>
                      {farm.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">方案状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {DECISION_STATUSES.map((s: DecisionStatus) => (
                  <SelectItem key={s} value={s}>
                    {DECISION_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">开始日期</Label>
            <Input
              type="date"
              className="w-[150px] bg-white"
              value={dateFrom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDateFrom(e.target.value)
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">结束日期</Label>
            <Input
              type="date"
              className="w-[150px] bg-white"
              value={dateTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDateTo(e.target.value)
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">时间排序</Label>
            <Select
              value={sortOrder}
              onValueChange={(v: string) => setSortOrder(v as 'desc' | 'asc')}
            >
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">最新在前</SelectItem>
                <SelectItem value="asc">最旧在前</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            共 <span className="font-semibold text-foreground">{total}</span> 条记录
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      {loading ? (
        <Card>
          <CardContent className="flex min-h-[300px] items-center justify-center">
            <div className="text-sm text-muted-foreground">加载中...</div>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[400px] flex-col items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <History className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mt-4 text-base font-medium text-foreground">
              暂无历史决策记录
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              生成灌溉决策后,记录将显示在这里
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((record: IrrigationDecisionRecord) => {
            const planned = plannedMm(record);
            const exec = executedSummary(record);
            const isLatestValid = latestValidIds.has(record.id);
            return (
              <Card
                key={record.id}
                className={`transition-all hover:shadow-md ${
                  record.status === 'superseded' ? 'opacity-75' : ''
                }`}
              >
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="flex w-36 flex-col">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      生成时间
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {formatDateTime(record.createdAt)}
                    </div>
                  </div>

                  <div className="flex w-36 flex-col">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      农田
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {record.farmName}
                    </div>
                  </div>

                  <div className="flex w-28 flex-col">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      风险等级
                    </div>
                    <div className="mt-1">
                      <Badge variant="outline" className={riskBadgeClass(record.waterRiskLevel)}>
                        {WATER_RISK_META[record.waterRiskLevel].label}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex w-28 flex-col">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Droplets className="h-3.5 w-3.5" />
                      方案状态
                    </div>
                    <div className="mt-1">
                      <Badge variant="outline" className={statusBadgeClass(record.status)}>
                        {DECISION_STATUS_META[record.status].label}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex w-32 flex-col">
                    <div className="text-xs text-muted-foreground">
                      计划灌溉 {effectivePlan(record).length} 次
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {planned.toFixed(1)} mm
                    </div>
                  </div>

                  <div className="flex w-32 flex-col">
                    <div className="text-xs text-muted-foreground">
                      实际执行 {exec.count} 次
                    </div>
                    <div
                      className={`mt-1 text-sm font-medium ${
                        exec.count > 0 ? 'text-green-700' : 'text-muted-foreground'
                      }`}
                    >
                      {exec.count > 0 ? `${exec.mm.toFixed(1)} mm` : '未执行'}
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    {isLatestValid && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        最新有效
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailId(record.id)}
                      className="gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
                    >
                      <Eye className="h-4 w-4" />
                      查看详情
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {items.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={page <= 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={page >= totalPages}
              className="gap-1"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      <Dialog open={detailId !== null} onOpenChange={(open: boolean) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">灌溉决策详情</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.farmName} · ${formatDateTime(detail.createdAt)}`
                : '加载中...'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex py-12 items-center justify-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : (
            <div className="space-y-5">
              {/* 基本信息 + 状态 */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  基本信息
                </h4>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">农田名称:</span>
                    <span className="font-medium">{detail.farmName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">生成时间:</span>
                    <span className="font-medium">{formatDateTime(detail.createdAt)}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-muted-foreground">方案状态:</span>
                    <Badge variant="outline" className={statusBadgeClass(detail.status)}>
                      {DECISION_STATUS_META[detail.status].label}
                    </Badge>
                    {detail.status === 'superseded' && (
                      <span className="text-xs text-muted-foreground">
                        已被该农田更新方案替代
                      </span>
                    )}
                  </div>
                </div>
              </section>

              {/* 田间输入数据 */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  田间输入数据
                </h4>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-green-100 bg-green-50/50 p-3 text-sm sm:grid-cols-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Droplets className="h-3 w-3" />
                      土壤含水率
                    </span>
                    <span className="font-semibold text-foreground">
                      {detail.soilMoisture.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Thermometer className="h-3 w-3" />
                      土壤温度
                    </span>
                    <span className="font-semibold text-foreground">
                      {detail.soilTemperature.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Sun className="h-3 w-3" />
                      空气温度
                    </span>
                    <span className="font-semibold text-foreground">
                      {detail.airTemperature.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wind className="h-3 w-3" />
                      空气湿度
                    </span>
                    <span className="font-semibold text-foreground">
                      {detail.airHumidity}%
                    </span>
                  </div>
                </div>
              </section>

              {/* 环境信息摘要 */}
              {weatherSummary && (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    天气信息
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      获取时间:{formatDateTime(detail.createdAt)}(天气快照随决策生成)
                    </span>
                  </h4>
                  <div className="grid grid-cols-3 gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">最高气温</span>
                      <span className="font-semibold text-foreground">
                        {weatherSummary.tempMax.toFixed(1)}°C
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">最低气温</span>
                      <span className="font-semibold text-foreground">
                        {weatherSummary.tempMin.toFixed(1)}°C
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CloudRain className="h-3 w-3" />
                        总降雨量
                      </span>
                      <span className="font-semibold text-foreground">
                        {weatherSummary.totalRainfall.toFixed(1)} mm
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* 计算方法 / 模型版本 */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  计算方法与模型
                </h4>
                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-muted-foreground">灌溉计划:</span>
                    <span className="font-medium">
                      FAO-56 蒸散规则引擎 v1(7 天水量平衡)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-muted-foreground">AI 诊断模型:</span>
                    <span className="font-medium">
                      {detail.aiModel ?? '未使用 AI 判据'}
                    </span>
                  </div>
                  {(detail.aiDiagnosticCriteria?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-muted-foreground">AI 判据:</span>
                      {detail.aiDiagnosticCriteria?.map((c, idx: number) => (
                        <Badge key={idx} variant="outline" className="bg-white">
                          {c.label}
                        </Badge>
                      ))}
                      {detail.aiDiagnosticSummary && (
                        <span className="text-xs text-muted-foreground">
                          {detail.aiDiagnosticSummary}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* 未来7天蓄水量逐日数据 */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  预测结果:未来7天蓄水量
                </h4>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead className="text-right">ET₀ (mm)</TableHead>
                        <TableHead className="text-right">ETc (mm)</TableHead>
                        <TableHead className="text-right">降雨 (mm)</TableHead>
                        <TableHead className="text-right">蓄水量 (%)</TableHead>
                        <TableHead className="text-right">变化</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.waterStorageDaily.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell className="font-medium">
                            {day.date}
                          </TableCell>
                          <TableCell className="text-right">
                            {day.et0.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">
                            {day.etc.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">
                            {day.rainfall.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {(Number(day.storage) / 10).toFixed(1)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              Number(day.storageChange) >= 0
                                ? 'text-green-600'
                                : 'text-red-500'
                            }`}
                          >
                            {Number(day.storageChange) >= 0 ? '+' : ''}
                            {(Number(day.storageChange) / 10).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>

              {/* 风险等级 + 胁迫时间 */}
              <section>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-xs text-muted-foreground">水分风险等级</div>
                    <div className="mt-2">
                      <Badge variant="outline" className={riskBadgeClass(detail.waterRiskLevel)}>
                        {WATER_RISK_META[detail.waterRiskLevel].label}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-xs text-muted-foreground">预期胁迫时间</div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {detail.stressForecastDate
                        ? detail.stressForecastDate
                        : '暂无胁迫风险'}
                    </div>
                  </div>
                </div>
              </section>

              {/* 灌溉方案(建议) + 调整后方案对照 + 执行记录 */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  灌溉方案(建议)
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    共 {effectivePlan(detail).length} 次
                  </span>
                </h4>
                {detail.adjustedPlan && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
                    <PencilRuler className="h-3.5 w-3.5" />
                    本方案经过人工调整,以下展示调整后的方案
                  </div>
                )}
                {effectivePlan(detail).length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-muted-foreground">
                    本期无需灌溉,土壤水分充足
                  </div>
                ) : (
                  <div className="space-y-2">
                    {effectivePlan(detail).map((evt: IrrigationEvent, idx: number) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-4 rounded-lg border border-green-100 bg-green-50/40 p-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-[160px]">
                          <div className="text-xs text-muted-foreground">灌溉日期</div>
                          <div className="text-sm font-medium text-foreground">
                            {evt.date}
                          </div>
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <div className="text-xs text-muted-foreground">灌溉量</div>
                          <div className="text-sm font-medium text-green-700">
                            {evt.amountMm.toFixed(1)} mm / {evt.amountM3.toFixed(1)} m³
                          </div>
                        </div>
                        <div className="flex-[2] min-w-[200px]">
                          <div className="text-xs text-muted-foreground">原因</div>
                          <div className="text-sm text-foreground">{evt.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 实际执行记录 */}
              <section>
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  实际执行记录
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    共 {(detail.executionRecords ?? []).length} 次
                  </span>
                </h4>
                {(detail.executionRecords ?? []).length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-muted-foreground">
                    暂无执行记录
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(detail.executionRecords ?? []).map((r: ExecutionRecord, idx: number) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-4 rounded-lg border border-green-200 bg-green-50 p-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-[160px]">
                          <div className="text-xs text-muted-foreground">执行时间</div>
                          <div className="text-sm font-medium text-foreground">
                            {formatDateTime(r.executedAt)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <div className="text-xs text-muted-foreground">实际水量</div>
                          <div className="text-sm font-medium text-green-700">
                            {r.amountMm.toFixed(1)} mm / {r.amountM3.toFixed(1)} m³
                          </div>
                        </div>
                        {r.note && (
                          <div className="flex-[2] min-w-[160px]">
                            <div className="text-xs text-muted-foreground">备注</div>
                            <div className="text-sm text-foreground">{r.note}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoryPage;
