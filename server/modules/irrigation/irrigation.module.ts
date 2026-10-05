import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AiDiagnosticModule } from '../ai-diagnostic/ai-diagnostic.module';
import { IrrigationController } from './irrigation.controller';
import { IrrigationService } from './irrigation.service';
import { WeatherService } from './weather.service';

@Module({
  imports: [HttpModule, AiDiagnosticModule],
  controllers: [IrrigationController],
  providers: [IrrigationService, WeatherService],
})
export class IrrigationModule {}
