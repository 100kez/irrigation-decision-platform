import { Controller, Get, Render, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller()
export class ViewController {

  @Get(['/', '*'])
  @Render('index')
  async render(@Req() req: Request): Promise<{ __platform__: string; appName: string; appDescription: string; appAvatar: string }>  {
    // you can add custom render params here
    // 自托管部署：覆盖妙搭 SDK 中间件的默认值（appName 默认「妙搭应用」），
    // 否则页面标题 / og 元信息 / 客户端 __platform__ 都会带妙搭品牌名。
    const platformData = {
      ...(req.__platform_data__ ?? {}),
      appName: '灌溉决策平台',
      appDescription: '基于土壤墒情与气象数据的农业灌溉决策系统',
      appAvatar: '/assets/favicon.svg',
      showBadge: false,
    };
    return {
      // don't delete this line, it's used by client to get platform info
      __platform__: JSON.stringify(platformData),
      appName: platformData.appName,
      appDescription: platformData.appDescription,
      appAvatar: platformData.appAvatar,
    };
  }
}
