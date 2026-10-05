import { Module } from '@nestjs/common';

import { FarmController } from './farm.controller';
import { FarmService } from './farm.service';

@Module({
  imports: [],
  controllers: [FarmController],
  providers: [FarmService],
})
export class FarmModule {}
