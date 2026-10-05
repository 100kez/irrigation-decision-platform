import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { FarmModule } from './modules/farm/farm.module';
import { IrrigationModule } from './modules/irrigation/irrigation.module';
import { AiDiagnosticModule } from './modules/ai-diagnostic/ai-diagnostic.module';

@Module({
  imports: [
    PlatformModule.forRoot(),
    FarmModule,
    IrrigationModule,
    AiDiagnosticModule,
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
