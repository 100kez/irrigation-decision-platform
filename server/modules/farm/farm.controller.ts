import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { Farm, FarmListResponse } from '@shared/api.interface';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { FarmService } from './farm.service';

@Controller('api/farms')
export class FarmController {
  constructor(private readonly farmService: FarmService) {}

  @Get()
  async list(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
  ): Promise<FarmListResponse> {
    const pageNum: number = page ? parseInt(page, 10) : 1;
    const pageSizeNum: number = pageSize ? parseInt(pageSize, 10) : 10;
    return this.farmService.list(pageNum, pageSizeNum);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Farm> {
    return this.farmService.getById(id);
  }

  @Post()
  async create(@Body() dto: CreateFarmDto): Promise<Farm> {
    return this.farmService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFarmDto,
  ): Promise<Farm> {
    return this.farmService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ id: string }> {
    return this.farmService.remove(id);
  }
}
