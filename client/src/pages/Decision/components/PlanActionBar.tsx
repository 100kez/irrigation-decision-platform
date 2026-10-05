import { useState } from 'react';
import { CalendarCheck, ClipboardList, PencilRuler, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { IrrigationDecisionRecord, IrrigationEvent } from '@shared/api.interface';
import { DECISION_STATUS_META, formatDateTime, type ExecutionRecord } from '@shared/decisionMeta';

import { irrigationApi } from '@/api/irrigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { statusBadgeClass } from '@/lib/decision-visual';

interface PlanActionBarProps {
  decision: IrrigationDecisionRecord;
  onUpdated: (record: IrrigationDecisionRecord) => void;
}

interface EditableEvent {
  date: string;
  amountMm: string;
  amountM3: string;
  reason: string;
}

function eventsToEditable(events: IrrigationEvent[]): EditableEvent[] {
  return events.map((e: IrrigationEvent) => ({
    date: e.date,
    amountMm: String(e.amountMm),
    amountM3: String(e.amountM3),
    reason: e.reason,
  }));
}

/**
 * 结果区第 4 段:方案操作。
 * 采纳建议 / 调整计划 / 暂不执行 / 记录执行;
 * 采纳不等于执行——执行时记录真实时间与水量,可多次追加。
 */
export function PlanActionBar({ decision, onUpdated }: PlanActionBarProps) {
  const [busy, setBusy] = useState<string | null>(null);

  // 调整计划对话框
  const [planOpen, setPlanOpen] = useState(false);
  const [editable, setEditable] = useState<EditableEvent[]>([]);
  const [planSaving, setPlanSaving] = useState(false);

  // 记录执行对话框
  const [execOpen, setExecOpen] = useState(false);
  const [execForm, setExecForm] = useState({
    executedAt: '',
    amountMm: '',
    amountM3: '',
    note: '',
  });
  const [execSaving, setExecSaving] = useState(false);

  const status = decision.status;
  const statusMeta = DECISION_STATUS_META[status];
  const effectivePlan = decision.adjustedPlan ?? decision.irrigationPlan;
  const records = decision.executionRecords ?? [];

  const handleStatus = async (target: 'adopted' | 'rejected') => {
    setBusy(target);
    try {
      const updated = await irrigationApi.updateDecisionStatus(decision.id, {
        status: target,
      });
      onUpdated(updated);
      toast.success(
        target === 'adopted' ? '已采纳建议，方案进入执行准备' : '已标记暂不执行',
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(`操作失败:${msg || '请重试'}`);
    } finally {
      setBusy(null);
    }
  };

  const openPlanDialog = () => {
    setEditable(eventsToEditable(effectivePlan));
    setPlanOpen(true);
  };

  const savePlan = async () => {
    const events: IrrigationEvent[] = editable
      .filter((e: EditableEvent) => e.date && e.amountMm !== '')
      .map((e: EditableEvent) => ({
        date: e.date,
        amountMm: Number(e.amountMm),
        amountM3: Number(e.amountM3),
        reason: e.reason || '人工调整',
      }));
    setPlanSaving(true);
    try {
      const updated = await irrigationApi.updatePlan(decision.id, { events });
      onUpdated(updated);
      setPlanOpen(false);
      toast.success('调整后的方案已保存');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(`保存失败:${msg || '请重试'}`);
    } finally {
      setPlanSaving(false);
    }
  };

  const openExecDialog = () => {
    setExecForm({ executedAt: '', amountMm: '', amountM3: '', note: '' });
    setExecOpen(true);
  };

  const saveExecution = async () => {
    if (!execForm.executedAt) {
      toast.error('请填写实际执行时间');
      return;
    }
    const amountMm = Number(execForm.amountMm);
    if (execForm.amountMm === '' || isNaN(amountMm) || amountMm < 0) {
      toast.error('请填写有效的执行水量(mm)');
      return;
    }
    setExecSaving(true);
    try {
      const updated = await irrigationApi.addExecution(decision.id, {
        executedAt: execForm.executedAt,
        amountMm,
        amountM3: execForm.amountM3 ? Number(execForm.amountM3) : undefined,
        note: execForm.note || undefined,
      });
      onUpdated(updated);
      setExecOpen(false);
      toast.success('执行记录已保存');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(`记录失败:${msg || '请重试'}`);
    } finally {
      setExecSaving(false);
    }
  };

  const canAdjust = status !== 'superseded';
  const canExecute = status !== 'superseded';
  const canAdoptOrReject = ['pending', 'adopted', 'rejected'].includes(status);
  const totalExecutedMm = records.reduce((s: number, r: ExecutionRecord) => s + r.amountMm, 0);
  const totalExecutedM3 = records.reduce((s: number, r: ExecutionRecord) => s + r.amountM3, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-emerald-600" />
          方案操作
        </CardTitle>
        <CardDescription>
          采纳与实际执行使用不同状态;执行时记录真实时间与水量
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">当前状态:</span>
          <Badge variant="outline" className={statusBadgeClass(status)}>
            {statusMeta.label}
          </Badge>
          {status === 'superseded' && (
            <span className="text-xs text-muted-foreground">
              该方案已被同一农田的更新方案替代,仅作存档查看
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {canAdoptOrReject && status !== 'adopted' && (
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={busy !== null}
              onClick={() => void handleStatus('adopted')}
            >
              {busy === 'adopted' ? '处理中...' : '采纳建议'}
            </Button>
          )}
          {canAdoptOrReject && status !== 'rejected' && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void handleStatus('rejected')}
            >
              {busy === 'rejected' ? '处理中...' : '暂不执行'}
            </Button>
          )}
          {canAdjust && (
            <Button size="sm" variant="outline" onClick={openPlanDialog}>
              <PencilRuler className="mr-1.5 h-3.5 w-3.5" />
              调整计划
            </Button>
          )}
          {canExecute && (
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              onClick={openExecDialog}
            >
              <CalendarCheck className="mr-1.5 h-3.5 w-3.5" />
              记录执行
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          提示:「采纳」表示认可方案,「记录执行」才表示实际灌溉;已执行的方案状态自动变为已执行。
        </p>

        {records.length > 0 && (
          <div className="rounded-lg bg-green-50 px-3 py-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-green-800">
              <span>实际执行记录</span>
              <span>
                合计 {records.length} 次 · {totalExecutedMm.toFixed(1)} mm /{' '}
                {totalExecutedM3.toFixed(1)} m³
              </span>
            </div>
            <ul className="mt-1.5 space-y-1 text-xs text-green-800/80">
              {records.map((r: ExecutionRecord, idx: number) => (
                <li key={idx}>
                  {formatDateTime(r.executedAt)} · {r.amountMm} mm(约 {r.amountM3} m³)
                  {r.note ? ` · ${r.note}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {decision.adjustedPlan && (
          <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
            已保存人工调整后的方案({decision.adjustedPlan.length} 次灌溉),展示口径以调整后方案为准
          </div>
        )}

        {/* 调整计划对话框 */}
        <Dialog open={planOpen} onOpenChange={setPlanOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>调整灌溉计划</DialogTitle>
              <DialogDescription>
                修改灌溉日期与水量后保存,展示口径将以调整后的方案为准
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {editable.map((e: EditableEvent, idx: number) => (
                <div key={idx} className="grid grid-cols-[1fr_90px_90px_1fr_36px] items-center gap-2">
                  <Input
                    type="date"
                    value={e.date}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
                      setEditable((prev) =>
                        prev.map((x: EditableEvent, i: number) =>
                          i === idx ? { ...x, date: ev.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="mm"
                    value={e.amountMm}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
                      setEditable((prev) =>
                        prev.map((x: EditableEvent, i: number) =>
                          i === idx ? { ...x, amountMm: ev.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="m³"
                    value={e.amountM3}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
                      setEditable((prev) =>
                        prev.map((x: EditableEvent, i: number) =>
                          i === idx ? { ...x, amountM3: ev.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="原因"
                    value={e.reason}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) =>
                      setEditable((prev) =>
                        prev.map((x: EditableEvent, i: number) =>
                          i === idx ? { ...x, reason: ev.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() =>
                      setEditable((prev) => prev.filter((_, i: number) => i !== idx))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEditable((prev) => [
                    ...prev,
                    { date: '', amountMm: '', amountM3: '', reason: '人工调整' },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                增加一次灌溉
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPlanOpen(false)} disabled={planSaving}>
                取消
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => void savePlan()}
                disabled={planSaving}
              >
                {planSaving ? '保存中...' : '保存调整'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 记录执行对话框 */}
        <Dialog open={execOpen} onOpenChange={setExecOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>记录实际执行</DialogTitle>
              <DialogDescription>
                填写本次灌溉的真实时间与水量,水量单位可留空自动换算
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="exec-at">
                  执行时间 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="exec-at"
                  type="datetime-local"
                  value={execForm.executedAt}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setExecForm((prev) => ({ ...prev, executedAt: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="exec-mm">
                    执行水量 (mm) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="exec-mm"
                    type="number"
                    step="0.1"
                    placeholder="例如:25"
                    value={execForm.amountMm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setExecForm((prev) => ({ ...prev, amountMm: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exec-m3">执行水量 (m³)</Label>
                  <Input
                    id="exec-m3"
                    type="number"
                    step="0.1"
                    placeholder="按面积自动换算"
                    value={execForm.amountM3}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setExecForm((prev) => ({ ...prev, amountM3: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exec-note">备注</Label>
                <Input
                  id="exec-note"
                  placeholder="例如:清晨滴灌"
                  value={execForm.note}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setExecForm((prev) => ({ ...prev, note: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExecOpen(false)} disabled={execSaving}>
                取消
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => void saveExecution()}
                disabled={execSaving}
              >
                {execSaving ? '保存中...' : '保存记录'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
