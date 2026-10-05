import { CloudRain, Droplets, Sun } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  ReferenceLine,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  FarmWithLatest,
  IrrigationDecisionRecord,
  WaterStorageDay,
  WeatherDayData,
} from '@shared/api.interface';
import { formatDate } from '@shared/decisionMeta';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface StorageChartCardProps {
  decision: IrrigationDecisionRecord;
  farm: FarmWithLatest | null;
}

interface ChartPoint {
  date: string;
  label: string;
  predicted: number; // 预测水分 %
  measured: number | null; // 实测水分 %(仅当日)
  stressed: boolean;
}

/**
 * 结果区第 3 段:图表详情。
 * 实测点(输入快照)与 7 天预测线区分展示,叠加胁迫阈值/萎蔫点参考线;
 * 下方保留天气明细与逐日水量明细表。
 */
export function StorageChartCard({ decision, farm }: StorageChartCardProps) {
  const daily = decision.waterStorageDaily;

  // storage(mm,根深 1000mm)换算为水分 %
  const data: ChartPoint[] = daily.map((day: WaterStorageDay, idx: number) => ({
    date: day.date,
    label: idx === 0 ? '今天' : formatDate(day.date).slice(5),
    predicted: Number((Number(day.storage) / 10).toFixed(1)),
    measured: idx === 0 ? decision.soilMoisture : null,
    stressed:
      farm !== null && Number(day.storage) / 10 < farm.stressThreshold,
  }));

  const chartConfig = {
    predicted: { label: '预测水分(%)', color: 'hsl(160 84% 32%)' },
    measured: { label: '当日实测(%)', color: 'hsl(24 95% 53%)' },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Droplets className="h-5 w-5 text-blue-500" />
          图表详情:实测与预测水分
        </CardTitle>
        <CardDescription>
          橙色点为当日实测水分,绿色曲线为未来 7 天预测;虚线为管理阈值参考
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              width={36}
              domain={['auto', 'auto']}
              tickLine={false}
              axisLine={false}
              unit="%"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value: number | string, name: string) => {
                    const key = String(name);
                    const label =
                      key === 'predicted'
                        ? '预测水分'
                        : key === 'measured'
                          ? '当日实测'
                          : key;
                    return [value === null || value === undefined ? '-' : `${value} %`, label];
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {farm !== null && (
              <>
                <ReferenceLine
                  y={farm.stressThreshold}
                  stroke="hsl(24 95% 53%)"
                  strokeDasharray="4 4"
                  label={{ value: `胁迫阈值 ${farm.stressThreshold}%`, position: 'insideBottomRight', fontSize: 11 }}
                />
                <ReferenceLine
                  y={farm.wiltingPoint}
                  stroke="hsl(0 72% 51%)"
                  strokeDasharray="4 4"
                  label={{ value: `萎蔫点 ${farm.wiltingPoint}%`, position: 'insideBottomRight', fontSize: 11 }}
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="var(--color-predicted)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--color-predicted)' }}
              connectNulls
            />
            <Scatter
              dataKey="measured"
              fill="var(--color-measured)"
              shape={(props: { cx?: number; cy?: number }) => (
                <circle cx={props.cx} cy={props.cy} r={5} fill="var(--color-measured)" />
              )}
            />
          </ComposedChart>
        </ChartContainer>

        {farm !== null && data.some((d: ChartPoint) => d.stressed) && (
          <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
            预测期内有 {data.filter((d: ChartPoint) => d.stressed).length} 天土壤水分低于胁迫阈值
            {farm.stressThreshold}%,建议关注缺水时间区间
          </div>
        )}

        {/* 天气明细 */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sun className="h-4 w-4 text-amber-500" />
            未来 7 天天气预报
          </h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>最高/最低温</TableHead>
                  <TableHead>湿度</TableHead>
                  <TableHead>降雨</TableHead>
                  <TableHead>太阳辐射</TableHead>
                  <TableHead>风速</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decision.weatherData.daily.map((day: WeatherDayData, idx: number) => (
                  <TableRow key={day.date} className={idx === 0 ? 'bg-amber-50/50' : ''}>
                    <TableCell className="font-medium">
                      {idx === 0 ? '今天' : formatDate(day.date)}
                    </TableCell>
                    <TableCell>
                      {day.temperatureMax}° / {day.temperatureMin}°
                    </TableCell>
                    <TableCell>{day.humidity}%</TableCell>
                    <TableCell>
                      {day.rainfall > 0 ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          <CloudRain className="mr-1 h-3 w-3" />
                          {day.rainfall}mm
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">无</span>
                      )}
                    </TableCell>
                    <TableCell>{day.solarRadiation} MJ/㎡</TableCell>
                    <TableCell>{day.windSpeed} m/s</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 逐日蓄水量明细 */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Droplets className="h-4 w-4 text-blue-500" />
            逐日蓄水量明细
          </h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>ET₀ (mm)</TableHead>
                  <TableHead>ETc (mm)</TableHead>
                  <TableHead>降雨 (mm)</TableHead>
                  <TableHead>蓄水量 (%)</TableHead>
                  <TableHead>变化 (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.map((day: WaterStorageDay) => (
                  <TableRow key={day.date}>
                    <TableCell className="font-medium">{formatDate(day.date)}</TableCell>
                    <TableCell>{Number(day.et0).toFixed(2)}</TableCell>
                    <TableCell>{Number(day.etc).toFixed(2)}</TableCell>
                    <TableCell>{Number(day.rainfall).toFixed(1)}</TableCell>
                    <TableCell>{(Number(day.storage) / 10).toFixed(1)}</TableCell>
                    <TableCell
                      className={
                        Number(day.storageChange) < 0
                          ? 'text-red-600'
                          : 'text-emerald-600'
                      }
                    >
                      {(Number(day.storageChange) / 10).toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
