import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';

import type {
  AiDiagnosticCriterion,
  AiChatMessage,
  CreateDecisionWithAiRequest,
  CreateDecisionRequest,
  FarmWithLatest,
  IrrigationDecisionRecord,
} from '@shared/api.interface';
import { formatDateTime, TECH_ROUTE_TEXT } from '@shared/decisionMeta';

import { farmApi } from '@/api/farm';
import { irrigationApi } from '@/api/irrigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAiDiagnostic } from '@/contexts/AiDiagnosticContext';

import {
  DataAcquisitionCard,
  DataSourceInfo,
  EMPTY_FORM,
  FIELD_LABELS,
  FieldDataForm,
  FieldModification,
} from './components/DataAcquisitionCard';
import { DataReadinessList } from './components/DataReadinessList';
import { DecisionResultActions } from './components/DecisionResultActions';
import { DecisionResultBasis } from './components/DecisionResultBasis';
import { FarmStrip } from './components/FarmStrip';
import { PlanActionBar } from './components/PlanActionBar';
import { StorageChartCard } from './components/StorageChartCard';

function validateForm(form: FieldDataForm): string | null {
  if (form.soilMoisture === '' || isNaN(Number(form.soilMoisture)))
    return '请输入有效的土壤含水率';
  const sm = Number(form.soilMoisture);
  if (sm < 0 || sm > 100) return '土壤含水率应在 0-100% 之间';
  if (form.soilTemperature === '' || isNaN(Number(form.soilTemperature)))
    return '请输入有效的土壤温度';
  if (form.airTemperature === '' || isNaN(Number(form.airTemperature)))
    return '请输入有效的空气温度';
  if (form.airHumidity === '' || isNaN(Number(form.airHumidity)))
    return '请输入有效的空气湿度';
  const ah = Number(form.airHumidity);
  if (ah < 0 || ah > 100) return '空气湿度应在 0-100% 之间';
  return null;
}

function recordToForm(record: IrrigationDecisionRecord): FieldDataForm {
  return {
    soilMoisture: String(record.soilMoisture),
    soilTemperature: String(record.soilTemperature),
    airTemperature: String(record.airTemperature),
    airHumidity: String(record.airHumidity),
  };
}

const DecisionPage = () => {
  const [searchParams] = useSearchParams();

  const [farms, setFarms] = useState<FarmWithLatest[]>([]);
  const [farmsLoading, setFarmsLoading] = useState<boolean>(true);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');

  const [form, setForm] = useState<FieldDataForm>(EMPTY_FORM);
  const [mode, setMode] = useState<'auto' | 'manual'>('manual');
  const [sourceInfo, setSourceInfo] = useState<DataSourceInfo | null>(null);
  const [autoSnapshot, setAutoSnapshot] = useState<FieldDataForm | null>(null);
  const [modifications, setModifications] = useState<FieldModification[]>([]);

  const [generating, setGenerating] = useState<boolean>(false);
  const [decision, setDecision] = useState<IrrigationDecisionRecord | null>(null);
  const [decisionLoading, setDecisionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const {
    criteria: aiCriteria,
    chatSummary: aiChatSummary,
    chatMessages: aiChatMessages,
  } = useAiDiagnostic();

  const selectedFarm = farms.find((f: FarmWithLatest) => f.id === selectedFarmId) || null;
  const hasHistory = !!selectedFarm?.latestDecision;

  // 1) 加载农田列表
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setFarmsLoading(true);
      try {
        const res = await farmApi.listFarms({ page: 1, pageSize: 100 });
        if (!cancelled) setFarms(res.items);
      } catch (err: unknown) {
        logger.error('获取农田列表失败', err);
        if (!cancelled) setError('加载农田列表失败');
      } finally {
        if (!cancelled) setFarmsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) URL 参数初始化:?decisionId= 打开已有方案,?farmId= 预选农田
  useEffect(() => {
    if (farms.length === 0) return;
    const decisionId = searchParams.get('decisionId');
    const farmId = searchParams.get('farmId');

    if (decisionId) {
      let cancelled = false;
      const load = async () => {
        setDecisionLoading(true);
        try {
          const record = await irrigationApi.getDecision(decisionId);
          if (cancelled) return;
          setDecision(record);
          setSelectedFarmId(record.farmId);
          setForm(recordToForm(record));
          setMode('manual');
          setSourceInfo({
            source: '历史决策记录(查看已有方案)',
            observedAt: record.createdAt,
          });
          setModifications([]);
          setAutoSnapshot(null);
        } catch (err: unknown) {
          logger.error('获取决策记录失败', err);
          if (!cancelled) setError('加载决策记录失败,请返回历史记录页重试');
        } finally {
          if (!cancelled) setDecisionLoading(false);
        }
      };
      void load();
      return () => {
        cancelled = true;
      };
    }

    if (farmId) {
      const exists = farms.some((f: FarmWithLatest) => f.id === farmId);
      if (exists) setSelectedFarmId(farmId);
    }
  }, [searchParams, farms]);

  // 3) 自动回填:取该农田最近一次决策的输入快照
  const autofill = useCallback(
    async (farm: FarmWithLatest) => {
      if (!farm.latestDecision) return;
      try {
        const record = await irrigationApi.getDecision(farm.latestDecision.id);
        const snapshot = recordToForm(record);
        setForm(snapshot);
        setAutoSnapshot(snapshot);
        setSourceInfo({
          source: '历史决策快照(自动获取)',
          observedAt: record.createdAt,
        });
        setModifications([]);
      } catch (err: unknown) {
        logger.error('自动回填失败', err);
        toast.error('自动回填失败,请切换人工录入');
      }
    },
    [],
  );

  // 4) 切换农田:清空结果与输入,保证结果与输入对应当前所选农田
  const handleFarmSelect = useCallback(
    (farmId: string) => {
      setSelectedFarmId(farmId);
      setDecision(null);
      setError(null);
      setForm(EMPTY_FORM);
      setSourceInfo(null);
      setAutoSnapshot(null);
      setModifications([]);
      const farm = farms.find((f: FarmWithLatest) => f.id === farmId);
      if (farm && mode === 'auto') {
        void autofill(farm);
      }
    },
    [farms, mode, autofill],
  );

  const handleModeChange = (next: 'auto' | 'manual') => {
    setMode(next);
    if (next === 'auto') {
      if (selectedFarm?.latestDecision) {
        void autofill(selectedFarm);
      } else {
        setForm(EMPTY_FORM);
        setSourceInfo(null);
        setAutoSnapshot(null);
        setModifications([]);
      }
    } else {
      setSourceInfo(null);
      setAutoSnapshot(null);
      setModifications([]);
    }
  };

  const handleFieldChange = (key: keyof FieldDataForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // 自动填入的数据被修改时保留修改记录
    if (mode === 'auto' && autoSnapshot && autoSnapshot[key] !== value) {
      setModifications((prev) => {
        const rest = prev.filter((m: FieldModification) => m.field !== key);
        return [
          ...rest,
          {
            field: key,
            fieldLabel: FIELD_LABELS[key],
            originalValue: autoSnapshot[key],
            newValue: value,
            changedAt: new Date().toISOString(),
          },
        ];
      });
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!selectedFarmId) {
      toast.error('请先选择农田');
      return;
    }
    const err = validateForm(form);
    if (err) {
      toast.error(err);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const base: CreateDecisionRequest = {
        farmId: selectedFarmId,
        soilMoisture: Number(form.soilMoisture),
        soilTemperature: Number(form.soilTemperature),
        airTemperature: Number(form.airTemperature),
        airHumidity: Number(form.airHumidity),
      };
      const payload: CreateDecisionWithAiRequest =
        aiCriteria.length > 0
          ? {
              ...base,
              aiDiagnosticContext: {
                chatSummary: aiChatSummary || 'AI 诊断判据',
                criteria: aiCriteria as AiDiagnosticCriterion[],
                messages: aiChatMessages as AiChatMessage[],
              },
            }
          : base;
      const result = await irrigationApi.createDecision(payload);
      setDecision(result);
      toast.success('灌溉决策已生成');
    } catch (err2: unknown) {
      logger.error('生成灌溉决策失败', err2);
      const msg =
        (err2 as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '生成决策失败,请重试');
      toast.error(msg || '生成决策失败,请重试');
    } finally {
      setGenerating(false);
    }
  }, [selectedFarmId, form, aiCriteria, aiChatMessages, aiChatSummary]);

  const generateButton = (
    <Button
      className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
      size="lg"
      onClick={() => void handleGenerate()}
      disabled={generating || !selectedFarmId}
    >
      <Sparkles className="mr-2 h-4 w-4" />
      {generating ? '生成中...' : '生成灌溉决策'}
    </Button>
  );

  const hasInputs =
    form.soilMoisture !== '' &&
    form.soilTemperature !== '' &&
    form.airTemperature !== '' &&
    form.airHumidity !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">灌溉决策</h1>
        <p className="text-sm text-muted-foreground">{TECH_ROUTE_TEXT}</p>
      </div>

      {/* 顶部农田横条 */}
      <FarmStrip
        farms={farms}
        selectedFarm={selectedFarm}
        loading={farmsLoading}
        onSelect={handleFarmSelect}
      />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: 数据采集 + 生成 */}
        <div className="space-y-6">
          <DataAcquisitionCard
            mode={mode}
            form={form}
            sourceInfo={sourceInfo}
            modifications={modifications}
            hasAutoSource={hasHistory}
            aiCriteriaCount={aiCriteria.length}
            onModeChange={handleModeChange}
            onAutoFill={() => selectedFarm && void autofill(selectedFarm)}
            onChange={handleFieldChange}
            generateButton={generateButton}
          />
        </div>

        {/* Right: 数据准备说明 / 生成中 / 失败 / 结果四段 */}
        <div className="space-y-6">
          {decisionLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                <h3 className="mt-4 text-base font-medium text-foreground">
                  正在加载决策方案...
                </h3>
              </CardContent>
            </Card>
          )}

          {!decisionLoading && generating && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                <h3 className="mt-4 text-base font-medium text-foreground">
                  正在生成灌溉决策...
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  正在获取天气预报并计算土壤水分变化
                </p>
              </CardContent>
            </Card>
          )}

          {!decisionLoading && error && !decision && !generating && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
                  <AlertTriangle className="h-7 w-7 text-amber-600" />
                </div>
                <h3 className="mt-4 text-base font-medium text-foreground">
                  生成失败
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => void handleGenerate()}
                >
                  重试(已保留输入内容)
                </Button>
              </CardContent>
            </Card>
          )}

          {!decisionLoading && !decision && !generating && !error && (
            <DataReadinessList
              hasFarm={!!selectedFarm}
              hasInputs={hasInputs}
              hasHistory={hasHistory}
              hasAiCriteria={aiCriteria.length > 0}
            />
          )}

          {!decisionLoading && decision && !generating && (
            <>
              {/* ① 建议动作 */}
              <DecisionResultActions decision={decision} />
              {/* ② 判断依据 */}
              <DecisionResultBasis
                decision={decision}
                farm={selectedFarm}
                hasHistory={hasHistory}
              />
              {/* ③ 图表详情 */}
              <StorageChartCard decision={decision} farm={selectedFarm} />
              {/* ④ 方案操作 */}
              <PlanActionBar decision={decision} onUpdated={setDecision} />
            </>
          )}
        </div>
      </div>

      {/* 生成时间水印(结果对应时间) */}
      {decision && (
        <p className="text-right text-xs text-muted-foreground">
          本页方案生成于 {formatDateTime(decision.createdAt)}
        </p>
      )}
    </div>
  );
};

export default DecisionPage;
