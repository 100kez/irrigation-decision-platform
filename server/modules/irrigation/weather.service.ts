import { BadRequestException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import type { WeatherData, WeatherDayData } from '@shared/api.interface';

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    relative_humidity_2m_mean?: number[];
    precipitation_sum?: number[];
    shortwave_radiation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
}

@Injectable()
export class WeatherService {
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast';

  constructor(private readonly httpService: HttpService) {}

  async getWeather(lat: number, lon: number): Promise<WeatherData> {
    const params: Record<string, string | number> = {
      latitude: lat,
      longitude: lon,
      daily:
        'temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum,shortwave_radiation_sum,wind_speed_10m_max',
      current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
      timezone: 'auto',
      forecast_days: 7,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get<OpenMeteoResponse>(this.baseUrl, { params }),
      );
      const data: OpenMeteoResponse = response.data;

      if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
        throw new BadRequestException('天气 API 返回数据为空');
      }

      const { daily, current } = data;
      const times: string[] = daily.time ?? [];
      const tMax: number[] = daily.temperature_2m_max ?? [];
      const tMin: number[] = daily.temperature_2m_min ?? [];
      const humidity: number[] = daily.relative_humidity_2m_mean ?? [];
      const precipitation: number[] = daily.precipitation_sum ?? [];
      const shortwave: number[] = daily.shortwave_radiation_sum ?? [];
      const wind: number[] = daily.wind_speed_10m_max ?? [];

      const dailyList: WeatherDayData[] = times.map((date: string, i: number) => {
        const tempMax = tMax[i] ?? 0;
        const tempMin = tMin[i] ?? 0;
        return {
          date,
          temperatureMax: Math.round(tempMax * 100) / 100,
          temperatureMin: Math.round(tempMin * 100) / 100,
          temperatureAvg: Math.round(((tempMax + tempMin) / 2) * 100) / 100,
          humidity: Math.round((humidity[i] ?? 0) * 100) / 100,
          rainfall: Math.round((precipitation[i] ?? 0) * 100) / 100,
          // shortwave_radiation_sum 单位 MJ/m²/day
          solarRadiation: Math.round((shortwave[i] ?? 0) * 100) / 100,
          windSpeed: Math.round((wind[i] ?? 0) * 100) / 100,
        };
      });

      return {
        daily: dailyList,
        current: {
          temperature: Math.round((current?.temperature_2m ?? 0) * 100) / 100,
          humidity: Math.round((current?.relative_humidity_2m ?? 0) * 100) / 100,
          windSpeed: Math.round((current?.wind_speed_10m ?? 0) * 100) / 100,
        },
      };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`获取天气数据失败: ${message}`);
    }
  }
}
