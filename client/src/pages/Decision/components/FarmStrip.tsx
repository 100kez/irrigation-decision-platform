import { ChevronDown, Leaf, MapPin, Ruler, Sprout, Waves } from 'lucide-react';

import type { FarmWithLatest } from '@shared/api.interface';
import {
  getGrowthStage,
  getMoistureStatus,
  GROWTH_STAGE_LABELS,
  IRRIGATION_METHOD_LABELS,
  MOISTURE_STATUS_META,
  SOIL_TYPE_LABELS,
  translateEnum,
} from '@shared/decisionMeta';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { moistureBadgeClass } from '@/lib/decision-visual';

interface FarmStripProps {
  farms: FarmWithLatest[];
  selectedFarm: FarmWithLatest | null;
  loading: boolean;
  onSelect: (farmId: string) => void;
}

/**
 * 顶部农田横条:农田选择 + 一行摘要(作物/面积/生育阶段/最新水分状态),
 * 土壤、灌溉方式、坐标、阈值等详情按需展开。
 */
export function FarmStrip({ farms, selectedFarm, loading, onSelect }: FarmStripProps) {
  const growthStage = getGrowthStage(selectedFarm?.sowingDate);
  const moistureStatus = selectedFarm
    ? getMoistureStatus(
        selectedFarm.latestDecision?.soilMoisture ?? null,
        selectedFarm,
      )
    : 'no_data';

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="farm-strip-select" className="sr-only">
              选择农田
            </Label>
            <Select value={selectedFarm?.id ?? ''} onValueChange={onSelect} disabled={loading}>
              <SelectTrigger id="farm-strip-select" className="w-full">
                <SelectValue placeholder={loading ? '加载中...' : '请选择农田'} />
              </SelectTrigger>
              <SelectContent>
                {farms.map((farm: FarmWithLatest) => (
                  <SelectItem key={farm.id} value={farm.id}>
                    {farm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFarm && (
            <>
              <Badge variant="outline" className="gap-1">
                <Leaf className="h-3 w-3 text-emerald-600" />
                {translateEnum(selectedFarm.cropType, {}) || '未设置作物'}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Ruler className="h-3 w-3 text-emerald-600" />
                {selectedFarm.area} m²
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Sprout className="h-3 w-3 text-emerald-600" />
                {GROWTH_STAGE_LABELS[growthStage]}
              </Badge>
              <Badge variant="outline" className={moistureBadgeClass(moistureStatus)}>
                水分:{MOISTURE_STATUS_META[moistureStatus].label}
              </Badge>
            </>
          )}
        </div>

        {selectedFarm && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 gap-1 px-2 text-muted-foreground"
              >
                农田详情
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Waves className="h-3.5 w-3.5 text-emerald-600" />
                  土壤:{translateEnum(selectedFarm.soilType, SOIL_TYPE_LABELS)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Waves className="h-3.5 w-3.5 text-emerald-600" />
                  灌溉:{translateEnum(selectedFarm.irrigationMethod, IRRIGATION_METHOD_LABELS)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  {selectedFarm.longitude.toFixed(4)}°E, {selectedFarm.latitude.toFixed(4)}°N
                </span>
                <span>
                  阈值:田间持水量 {selectedFarm.fieldCapacity}% / 胁迫 {selectedFarm.stressThreshold}% /
                  萎蔫点 {selectedFarm.wiltingPoint}%
                </span>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
