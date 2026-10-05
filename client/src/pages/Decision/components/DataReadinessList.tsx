import { CheckCircle2, CircleAlert, Info, XCircle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

interface ReadinessItem {
  label: string;
  ready: boolean;
  unknown?: boolean;
  detail: string;
}

interface DataReadinessListProps {
  hasFarm: boolean;
  hasInputs: boolean;
  hasHistory: boolean;
  hasAiCriteria: boolean;
}

/**
 * 右侧空状态:数据准备说明清单。
 * 逐项说明农田档案 / 观测数据 / 历史数据 / 天气数据的可用性,
 * 以及生成后将展示的内容。
 */
export function DataReadinessList({
  hasFarm,
  hasInputs,
  hasHistory,
  hasAiCriteria,
}: DataReadinessListProps) {
  const items: ReadinessItem[] = [
    {
      label: '农田档案',
      ready: hasFarm,
      detail: hasFarm ? '作物、面积、土壤与阈值参数完整' : '请先在顶部选择农田',
    },
    {
      label: '田间观测数据',
      ready: hasInputs,
      detail: hasInputs ? '含水率与温湿度已填写' : '待填写 4 项观测值(人工录入或自动获取)',
    },
    {
      label: '历史决策数据',
      ready: hasHistory,
      detail: hasHistory
        ? '有历史记录可供参照'
        : '暂无历史决策记录，暂无可用的历史参照',
    },
    {
      label: '天气数据',
      ready: true,
      detail: '生成时自动获取(Open-Meteo 未来 7 天预报)',
    },
    {
      label: 'AI 诊断判据',
      ready: hasAiCriteria,
      unknown: true,
      detail: hasAiCriteria
        ? '已通过 AI 对话识别判据，将参与决策修正'
        : '未使用(可选，不影响规则引擎计算)',
    },
  ];

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-4 py-6">
        <div>
          <h3 className="text-base font-medium text-foreground">数据准备说明</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            生成决策前请确认以下数据是否可用
          </p>
        </div>

        <ul className="space-y-3">
          {items.map((item: ReadinessItem) => (
            <li key={item.label} className="flex items-start gap-2.5">
              {item.ready ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              ) : item.unknown ? (
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              )}
              <div>
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
            </li>
          ))}
        </ul>

        {!hasHistory && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              该农田暂无历史决策记录，暂无可用的历史参照。规则引擎(FAO-56
              水量平衡)仍可基于本次输入与天气预报正常计算。
            </span>
          </div>
        )}

        <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <div className="font-medium">生成后将展示:</div>
          <ol className="mt-1 list-inside list-decimal space-y-0.5">
            <li>建议动作:是否需要灌溉、建议时间与水量</li>
            <li>判断依据:当前/预测水分、阈值与天气影响</li>
            <li>图表详情:实测与预测水分变化、阈值参考</li>
            <li>方案操作:采纳、调整、执行与记录</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
