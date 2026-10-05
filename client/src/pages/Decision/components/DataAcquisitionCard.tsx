import { Brain, History, PenLine } from 'lucide-react';

import { formatDateTime } from '@shared/decisionMeta';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FieldDataForm {
  soilMoisture: string;
  soilTemperature: string;
  airTemperature: string;
  airHumidity: string;
}

export interface FieldModification {
  field: string;
  fieldLabel: string;
  originalValue: string;
  newValue: string;
  changedAt: string;
}

/** 数据来源:人工录入,或自动回填的最近一次决策快照 */
export interface DataSourceInfo {
  source: string; // 例如「历史决策快照 2026-10-05 16:00」
  observedAt: string | null; // 观测时间(快照的生成时间)
}

export const FIELD_LABELS: Record<keyof FieldDataForm, string> = {
  soilMoisture: '土壤含水率',
  soilTemperature: '土壤温度',
  airTemperature: '空气温度',
  airHumidity: '空气湿度',
};

export const EMPTY_FORM: FieldDataForm = {
  soilMoisture: '',
  soilTemperature: '',
  airTemperature: '',
  airHumidity: '',
};

interface DataAcquisitionCardProps {
  mode: 'auto' | 'manual';
  form: FieldDataForm;
  sourceInfo: DataSourceInfo | null;
  modifications: FieldModification[];
  hasAutoSource: boolean;
  aiCriteriaCount: number;
  onModeChange: (mode: 'auto' | 'manual') => void;
  onAutoFill: () => void;
  onChange: (key: keyof FieldDataForm, value: string) => void;
  generateButton: React.ReactNode;
}

/**
 * 田间数据采集卡:自动获取(回填最近一次观测快照)/人工录入两种方式。
 * 展示观测时间、数据来源、测量深度与单位;自动填入后被修改的值保留修改记录。
 */
export function DataAcquisitionCard({
  mode,
  form,
  sourceInfo,
  modifications,
  hasAutoSource,
  aiCriteriaCount,
  onModeChange,
  onAutoFill,
  onChange,
  generateButton,
}: DataAcquisitionCardProps) {
  const fieldConfigs: { key: keyof FieldDataForm; unit: string; placeholder: string }[] = [
    { key: 'soilMoisture', unit: '%', placeholder: '例如:25' },
    { key: 'soilTemperature', unit: '°C', placeholder: '例如:22' },
    { key: 'airTemperature', unit: '°C', placeholder: '例如:28' },
    { key: 'airHumidity', unit: '%', placeholder: '例如:65' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">田间观测数据</CardTitle>
            <CardDescription>输入当前田间实测数据以生成灌溉决策</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant={mode === 'manual' ? 'default' : 'outline'}
              size="sm"
              className={mode === 'manual' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
              onClick={() => onModeChange('manual')}
            >
              人工录入
            </Button>
            <Button
              variant={mode === 'auto' ? 'default' : 'outline'}
              size="sm"
              className={mode === 'auto' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
              onClick={() => onModeChange('auto')}
            >
              自动获取
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'auto' && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
            <History className="h-4 w-4 flex-shrink-0" />
            {hasAutoSource ? (
              <>
                <span>
                  已回填该农田最近一次观测数据
                  {sourceInfo?.observedAt ? `(观测时间 ${formatDateTime(sourceInfo.observedAt)})` : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-sky-700 underline"
                  onClick={onAutoFill}
                >
                  重新回填
                </Button>
              </>
            ) : (
              <span>该农田暂无历史观测数据，请切换人工录入</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {fieldConfigs.map(({ key, unit, placeholder }) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={`field-${key}`}>
                {FIELD_LABELS[key]} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id={`field-${key}`}
                  type="number"
                  step="0.1"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onChange(key, e.target.value)
                  }
                  className="pr-9"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {unit}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>数据来源:{sourceInfo?.source ?? '人工录入'}</span>
          {sourceInfo?.observedAt && <span>观测时间:{formatDateTime(sourceInfo.observedAt)}</span>}
          <span>测量深度:0-100cm 根层</span>
          <span>单位:% / °C</span>
        </div>

        {modifications.length > 0 && (
          <div className="rounded-lg bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <PenLine className="h-3.5 w-3.5" />
              已修改 {modifications.length} 项(自动填入值被修改)
            </div>
            <ul className="mt-1.5 space-y-1 text-xs text-amber-800/80">
              {modifications.map((m: FieldModification, idx: number) => (
                <li key={idx}>
                  {m.fieldLabel}:{m.originalValue || '空'} → {m.newValue || '空'}
                  <span className="ml-1 text-amber-700/60">({formatDateTime(m.changedAt)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {aiCriteriaCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <Brain className="h-4 w-4 flex-shrink-0" />
            <span>
              AI 已识别 <strong>{aiCriteriaCount}</strong> 项诊断判据，将参与本次决策
            </span>
          </div>
        )}

        {generateButton}
      </CardContent>
    </Card>
  );
}
