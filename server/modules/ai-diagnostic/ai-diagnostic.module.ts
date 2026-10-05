import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AiDiagnosticController } from './ai-diagnostic.controller';
import { AiDiagnosticService } from './ai-diagnostic.service';

@Module({
  imports: [HttpModule],
  controllers: [AiDiagnosticController],
  providers: [AiDiagnosticService],
  exports: [AiDiagnosticService],
})
export class AiDiagnosticModule {}
