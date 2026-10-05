import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Sprout,
  Pencil,
  Trash2,
  Droplets,
  MapPin,
  Ruler,
  Leaf,
  AlertTriangle,
  RotateCcw,
  Search,
  Eye,
  Activity,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { farmApi } from '@/api/farm';
import { irrigationApi } from '@/api/irrigation';
import type {
  Farm,
  FarmWithLatest,
  CreateFarmRequest,
  IrrigationDecisionRecord,
} from '@shared/api.interface';
import {
  formatDateTime,
  getGrowthStage,
  getMoistureStatus,
  GROWTH_STAGE_LABELS,
  MOISTURE_STATUS_META,
  SOIL_TYPE_LABELS,
  IRRIGATION_METHOD_LABELS,
  translateEnum,
  type MoistureStatus,
} from '@shared/decisionMeta';
import { moistureBadgeClass } from '@/lib/decision-visual';

const CROP_OPTIONS = [
  '玉米',
  '小麦',
  '水稻',
  '棉花',
  '大豆',
  '番茄',
  '其他',
] as const;

const SOIL_OPTIONS = ['壤土', '砂土', '黏土', '粉壤土'] as const;

const IRRIGATION_OPTIONS = ['滴灌', '喷灌', '漫灌', '微灌'] as const;

interface FarmFormData {
  name: string;
  longitude: string;
  latitude: string;
  cropType: string;
  sowingDate: string;
  soilType: string;
  area: string;
  irrigationMethod: string;
  fieldCapacity: string;
  wiltingPoint: string;
  stressThreshold: string;
}

const DEFAULT_FORM: FarmFormData = {
  name: '',
  longitude: '',
  latitude: '',
  cropType: '',
  sowingDate: '',
  soilType: '',
  area: '',
  irrigationMethod: '',
  fieldCapacity: '30',
  wiltingPoint: '10',
  stressThreshold: '18',
};

function farmToForm(farm: Farm): FarmFormData {
  return {
    name: farm.name,
    longitude: String(farm.longitude),
    latitude: String(farm.latitude),
    cropType: farm.cropType,
    sowingDate: farm.sowingDate?.slice(0, 10) ?? '',
    soilType: farm.soilType,
    area: String(farm.area),
    irrigationMethod: farm.irrigationMethod,
    fieldCapacity: String(farm.fieldCapacity),
    wiltingPoint: String(farm.wiltingPoint),
    stressThreshold: String(farm.stressThreshold),
  };
}

// 按上海时区取今天（与服务器时区一致），格式 YYYY-MM-DD
function todayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formToRequest(form: FarmFormData): CreateFarmRequest {
  return {
    name: form.name.trim(),
    longitude: Number(form.longitude),
    latitude: Number(form.latitude),
    cropType: form.cropType,
    sowingDate: form.sowingDate,
    soilType: form.soilType,
    area: Number(form.area),
    irrigationMethod: form.irrigationMethod,
    fieldCapacity: form.fieldCapacity ? Number(form.fieldCapacity) : undefined,
    wiltingPoint: form.wiltingPoint ? Number(form.wiltingPoint) : undefined,
    stressThreshold: form.stressThreshold
      ? Number(form.stressThreshold)
      : undefined,
  };
}

function validateForm(form: FarmFormData): string | null {
  if (!form.name.trim()) return '请输入农田名称';
  if (!form.sowingDate) return '请选择播种日期';
  if (form.longitude === '' || isNaN(Number(form.longitude)))
    return '请输入有效的经度';
  if (form.latitude === '' || isNaN(Number(form.latitude)))
    return '请输入有效的纬度';
  if (form.area === '' || isNaN(Number(form.area)) || Number(form.area) <= 0)
    return '请输入有效的田块面积';
  return null;
}

const FarmsPage = () => {
  const navigate = useNavigate();

  const [farms, setFarms] = useState<FarmWithLatest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 查看监测弹窗
  const [monitorTarget, setMonitorTarget] = useState<FarmWithLatest | null>(null);
  const [monitorRecord, setMonitorRecord] = useState<IrrigationDecisionRecord | null>(null);
  const [monitorLoading, setMonitorLoading] = useState<boolean>(false);

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [form, setForm] = useState<FarmFormData>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchFarms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await farmApi.listFarms({ page: 1, pageSize: 100 });
      setFarms(res.items);
    } catch (err: unknown) {
      logger.error('获取农田列表失败', err);
      setError('加载农田数据失败，请重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFarms();
  }, [fetchFarms]);

  const openCreateDialog = () => {
    setEditingFarm(null);
    setForm({ ...DEFAULT_FORM, sowingDate: todayInShanghai() });
    setDialogOpen(true);
  };

  const openEditDialog = (farm: Farm) => {
    setEditingFarm(farm);
    setForm(farmToForm(farm));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const err = validateForm(form);
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const payload = formToRequest(form);
      if (editingFarm) {
        await farmApi.updateFarm(editingFarm.id, payload);
        toast.success('农田信息已更新');
      } else {
        await farmApi.createFarm(payload);
        toast.success('农田创建成功');
      }
      setDialogOpen(false);
      await fetchFarms();
    } catch (err: unknown) {
      logger.error('保存农田失败', err);
      toast.error('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await farmApi.deleteFarm(deleteTarget.id);
      toast.success('农田已删除');
      setDeleteTarget(null);
      await fetchFarms();
    } catch (err: unknown) {
      logger.error('删除农田失败', err);
      toast.error('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  const goToDecision = (farm: Farm) => {
    navigate(`/decision?farmId=${encodeURIComponent(farm.id)}`);
  };

  // 查看监测:弹窗展示该农田最新一次观测快照
  const openMonitor = async (farm: FarmWithLatest) => {
    setMonitorTarget(farm);
    setMonitorRecord(null);
    if (!farm.latestDecision) return;
    setMonitorLoading(true);
    try {
      const record = await irrigationApi.getDecision(farm.latestDecision.id);
      setMonitorRecord(record);
    } catch (err: unknown) {
      logger.error('获取监测数据失败', err);
      toast.error('获取监测数据失败，请重试');
    } finally {
      setMonitorLoading(false);
    }
  };

  const filteredFarms = useMemo(() => {
    return farms.filter((f: FarmWithLatest) => {
      if (search && !f.name.toLowerCase().includes(search.trim().toLowerCase()))
        return false;
      if (statusFilter === 'all') return true;
      const moisture = getMoistureStatus(
        f.latestDecision?.soilMoisture ?? null,
        f,
      );
      if (statusFilter === 'no_data') return moisture === 'no_data';
      return moisture === statusFilter;
    });
  }, [farms, search, statusFilter]);

  const updateField = (key: keyof FarmFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const areaInMu = (area: number) => (area / 666.67).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">农田管理</h1>
          <p className="text-sm text-muted-foreground">
            管理您的所有农田基础信息
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索农田名称"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(e.target.value)
              }
              className="w-44 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="水分状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="wet">偏湿</SelectItem>
              <SelectItem value="suitable">适宜</SelectItem>
              <SelectItem value="dry">偏干</SelectItem>
              <SelectItem value="stress">胁迫</SelectItem>
              <SelectItem value="no_data">数据不足</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4" />
            新增农田
          </Button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          }}
        >
          {[0, 1, 2, 3].map((i: number) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-8 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
            <h3 className="mt-4 text-base font-medium text-foreground">
              加载失败
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void fetchFarms()}
            >
              <RotateCcw className="h-4 w-4" />
              重新加载
            </Button>
          </CardContent>
        </Card>
      ) : farms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <Sprout className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-base font-medium text-foreground">
              暂无农田数据
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              点击右上角新增农田，开始管理您的农田
            </p>
            <Button
              className="mt-6 bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4" />
              新增农田
            </Button>
          </CardContent>
        </Card>
      ) : filteredFarms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="mt-4 text-base font-medium text-foreground">
              没有符合条件的农田
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              请调整搜索关键词或状态筛选
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          data-ai-section-type="card-list"
          className="grid gap-6"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          }}
        >
          {filteredFarms.map((farm: FarmWithLatest) => {
            const moisture = getMoistureStatus(
              farm.latestDecision?.soilMoisture ?? null,
              farm,
            );
            const growthStage = getGrowthStage(farm.sowingDate);
            return (
              <Card
                key={farm.id}
                className="flex flex-col overflow-hidden transition-all hover:shadow-md"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl font-semibold">
                      {farm.name}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={moistureBadgeClass(moisture)}
                    >
                      水分:{MOISTURE_STATUS_META[moisture].label}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    经度 {farm.longitude.toFixed(4)} / 纬度{' '}
                    {farm.latitude.toFixed(4)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-emerald-50 text-emerald-700 border-transparent"
                    >
                      <Leaf className="mr-1 h-3 w-3" />
                      {translateEnum(farm.cropType, {}) || '未设置'}
                    </Badge>
                    <Badge variant="outline">
                      <Sprout className="mr-1 h-3 w-3" />
                      {GROWTH_STAGE_LABELS[growthStage]}
                    </Badge>
                    <Badge variant="outline">
                      {translateEnum(farm.soilType, SOIL_TYPE_LABELS) || '未设置'}
                    </Badge>
                    <Badge variant="outline">
                      {translateEnum(farm.irrigationMethod, IRRIGATION_METHOD_LABELS) || '未设置'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        farm.latestDecision
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }
                    >
                      <Activity className="mr-1 h-3 w-3" />
                      {farm.latestDecision ? '已接入' : '未接入'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Ruler className="h-4 w-4" />
                      面积
                    </div>
                    <div className="text-right font-medium">
                      {farm.area.toFixed(0)} m²
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({areaInMu(farm.area)} 亩)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      最新数据时间
                    </div>
                    <div className="text-right font-medium">
                      {farm.latestDecision
                        ? formatDateTime(farm.latestDecision.createdAt).slice(5, 16)
                        : '暂无数据'}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 border-t pt-4">
                  <div className="flex w-full items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
                      onClick={() => goToDecision(farm)}
                    >
                      <Droplets className="mr-1 h-3.5 w-3.5" />
                      生成决策
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={!farm.latestDecision}
                      onClick={() =>
                        navigate(`/history?farmId=${encodeURIComponent(farm.id)}`)
                      }
                    >
                      查看最新决策
                    </Button>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={!farm.latestDecision}
                      onClick={() => void openMonitor(farm)}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      查看监测
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(farm)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      编辑资料
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(farm)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFarm ? '编辑农田' : '新增农田'}
            </DialogTitle>
            <DialogDescription>
              {editingFarm
                ? '修改农田基础信息，保存后立即生效'
                : '填写农田基础信息，创建后可进行灌溉决策'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="farm-name">
                农田名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="farm-name"
                placeholder="请输入农田名称"
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField('name', e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-longitude">
                经度 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="farm-longitude"
                type="number"
                step="0.0001"
                placeholder="如 116.4074"
                value={form.longitude}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField('longitude', e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-latitude">
                纬度 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="farm-latitude"
                type="number"
                step="0.0001"
                placeholder="如 39.9042"
                value={form.latitude}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField('latitude', e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-crop">作物种类</Label>
              <Select
                value={form.cropType}
                onValueChange={(val: string) => updateField('cropType', val)}
              >
                <SelectTrigger id="farm-crop" className="w-full">
                  <SelectValue placeholder="请选择作物种类" />
                </SelectTrigger>
                <SelectContent>
                  {CROP_OPTIONS.map((crop: string) => (
                    <SelectItem key={crop} value={crop}>
                      {crop}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-sowing-date">播种日期</Label>
              <Input
                id="farm-sowing-date"
                type="date"
                value={form.sowingDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField('sowingDate', e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-soil">土壤类型</Label>
              <Select
                value={form.soilType}
                onValueChange={(val: string) => updateField('soilType', val)}
              >
                <SelectTrigger id="farm-soil" className="w-full">
                  <SelectValue placeholder="请选择土壤类型" />
                </SelectTrigger>
                <SelectContent>
                  {SOIL_OPTIONS.map((soil: string) => (
                    <SelectItem key={soil} value={soil}>
                      {soil}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-area">
                田块面积 (m²) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="farm-area"
                type="number"
                min="0"
                step="0.01"
                placeholder="请输入面积"
                value={form.area}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField('area', e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-irrigation">灌溉方式</Label>
              <Select
                value={form.irrigationMethod}
                onValueChange={(val: string) =>
                  updateField('irrigationMethod', val)
                }
              >
                <SelectTrigger id="farm-irrigation" className="w-full">
                  <SelectValue placeholder="请选择灌溉方式" />
                </SelectTrigger>
                <SelectContent>
                  {IRRIGATION_OPTIONS.map((method: string) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-field-capacity">
                田间持水量 (%)
              </Label>
              <Input
                id="farm-field-capacity"
                type="number"
                min="0"
                max="100"
                value={form.fieldCapacity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField('fieldCapacity', e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-wilting-point">萎蔫系数 (%)</Label>
              <Input
                id="farm-wilting-point"
                type="number"
                min="0"
                max="100"
                value={form.wiltingPoint}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField('wiltingPoint', e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="farm-stress-threshold">胁迫阈值 (%)</Label>
              <Input
                id="farm-stress-threshold"
                type="number"
                min="0"
                max="100"
                value={form.stressThreshold}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField('stressThreshold', e.target.value)
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              className="bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? '保存中...' : editingFarm ? '保存修改' : '创建农田'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monitor Snapshot Dialog */}
      <Dialog
        open={!!monitorTarget}
        onOpenChange={(open: boolean) => {
          if (!open) setMonitorTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>监测数据 · {monitorTarget?.name}</DialogTitle>
            <DialogDescription>最近一次观测快照</DialogDescription>
          </DialogHeader>
          {monitorLoading ? (
            <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : monitorRecord ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700">土壤含水率</div>
                  <div className="mt-1 font-semibold text-emerald-900">
                    {monitorRecord.soilMoisture} %
                  </div>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <div className="text-xs text-amber-700">土壤温度</div>
                  <div className="mt-1 font-semibold text-amber-900">
                    {monitorRecord.soilTemperature} °C
                  </div>
                </div>
                <div className="rounded-lg bg-sky-50 p-3">
                  <div className="text-xs text-sky-700">空气温度</div>
                  <div className="mt-1 font-semibold text-sky-900">
                    {monitorRecord.airTemperature} °C
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="text-xs text-blue-700">空气湿度</div>
                  <div className="mt-1 font-semibold text-blue-900">
                    {monitorRecord.airHumidity} %
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-muted-foreground">
                <p>观测时间:{formatDateTime(monitorRecord.createdAt)}</p>
                <p className="mt-0.5">数据来源:灌溉决策观测录入 · 测量深度:0-100cm 根层</p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              该农田暂无观测数据,请先生成一次决策
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonitorTarget(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除农田？</AlertDialogTitle>
            <AlertDialogDescription>
              您即将删除农田「{deleteTarget?.name}」，删除后数据不可恢复，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground border-destructive-border hover:bg-destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FarmsPage;
