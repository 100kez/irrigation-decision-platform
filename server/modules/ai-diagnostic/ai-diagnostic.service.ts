import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import type {
  AiChatMessage,
  AiDiagnosticChatResponse,
  AiDiagnosticCriterion,
  AiDiagnosticCriterionType,
} from '@shared/api.interface';

interface DeepSeekMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | DeepSeekMessageContent[];
}

interface DeepSeekChoice {
  message: DeepSeekMessage;
  finish_reason: string;
}

interface DeepSeekResponse {
  choices: DeepSeekChoice[];
  error?: { message: string; code: string };
}

const SYSTEM_PROMPT = `你是一位经验丰富的农业专家和作物诊断助手，专注于帮助农民识别作物问题并给出实用建议。

【你的任务】
1. 用通俗易懂的语言回答农民关于作物健康的问题
2. 仔细分析用户描述的症状和提供的照片（如有）
3. 给出可能的原因判断和应对建议
4. 引导用户补充关键信息以便更精确判断

【回答要求】
- 语气亲切，避免专业术语晦涩难懂
- 先给出初步判断，再说明需要确认的信息
- 建议要具体、可操作
- 每次回答不超过 300 字

【需要引导用户补充的关键信息】
- 发病部位（叶片/茎秆/根部/果实）
- 症状颜色和形态（发黄/斑点/卷曲/萎蔫等）
- 发生范围（零星/成片/整株）
- 是否蔓延扩散
- 近期天气情况（温度/降雨/湿度）
- 近期农事操作（施肥/打药/浇水）

【重要】请在回答的最后，用 JSON 格式输出你识别到的诊断判据，用 <diagnostic> 和 </diagnostic> 标签包裹。判据类型只能是以下之一：wilt（萎蔫卷曲）、root_rot（根部病害烂根）、heat_burn（叶片灼伤高温危害）、pest（病虫害）、nutrient（营养缺素）、normal（长势良好）。

JSON 格式示例：
<diagnostic>
{"criteria": [{"type": "wilt", "label": "叶片萎蔫", "description": "叶片出现卷曲下垂现象", "impact": "作物水分胁迫明显，需提高水分风险等级"}], "summary": "疑似缺水导致的叶片萎蔫"}
</diagnostic>

如果暂无法明确判断，criteria 可为空数组。`;

const VALID_CRITERIA_TYPES: AiDiagnosticCriterionType[] = [
  'wilt',
  'root_rot',
  'heat_burn',
  'pest',
  'nutrient',
  'normal',
];

@Injectable()
export class AiDiagnosticService {
  private readonly logger = new Logger(AiDiagnosticService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly httpService: HttpService) {
    this.baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com/v1';
    this.apiKey = process.env.AI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'deepseek-chat';
  }

  getModelConfig(): { baseUrl: string; model: string; hasKey: boolean } {
    return {
      baseUrl: this.baseUrl,
      model: this.model,
      hasKey: !!this.apiKey,
    };
  }

  async chat(
    messages: AiChatMessage[],
    cropType?: string,
  ): Promise<AiDiagnosticChatResponse> {
    if (!this.apiKey) {
      return this.getFallbackResponse(messages);
    }

    const deepSeekMessages: DeepSeekMessage[] = [
      {
        role: 'system',
        content: cropType
          ? `${SYSTEM_PROMPT}\n\n当前作物类型：${this.getCropName(cropType)}`
          : SYSTEM_PROMPT,
      },
      ...messages.map((m: AiChatMessage) => this.convertMessage(m)),
    ];

    try {
      const response = await firstValueFrom(
        this.httpService.post<DeepSeekResponse>(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.model,
            messages: deepSeekMessages,
            temperature: 0.7,
            max_tokens: 1024,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            timeout: 30000,
          },
        ),
      );

      const data: DeepSeekResponse = response.data;

      if (data.error) {
        this.logger.error(`DeepSeek API error: ${data.error.message}`);
        throw new BadRequestException(
          `AI 服务异常: ${data.error.message}`,
        );
      }

      const choice: DeepSeekChoice | undefined = data.choices?.[0];
      if (!choice) {
        throw new BadRequestException('AI 服务返回为空');
      }

      const rawContent: string =
        typeof choice.message.content === 'string'
          ? choice.message.content
          : '';

      return this.parseAiResponse(rawContent);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI chat failed: ${message}`);
      throw new BadRequestException(`AI 诊断服务调用失败: ${message}`);
    }
  }

  private convertMessage(msg: AiChatMessage): DeepSeekMessage {
    if (msg.imageUrls && msg.imageUrls.length > 0) {
      const content: DeepSeekMessageContent[] = [
        { type: 'text', text: msg.content },
        ...msg.imageUrls.map((url: string) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ];
      return { role: msg.role, content };
    }
    return { role: msg.role, content: msg.content };
  }

  parseAiResponse(rawContent: string): AiDiagnosticChatResponse {
    const diagnosticMatch = rawContent.match(
      /<diagnostic>([\s\S]*?)<\/diagnostic>/,
    );

    let reply: string = rawContent;
    let criteria: AiDiagnosticCriterion[] = [];
    let diagnosticSummary: string | undefined;

    if (diagnosticMatch) {
      reply = rawContent
        .replace(diagnosticMatch[0], '')
        .trim()
        .replace(/\n{3,}/g, '\n\n');

      try {
        const diagnosticJson = JSON.parse(diagnosticMatch[1].trim());
        criteria = (diagnosticJson.criteria || [])
          .filter((c: { type: string }) =>
            VALID_CRITERIA_TYPES.includes(c.type as AiDiagnosticCriterionType),
          )
          .map((c: { type: string; label: string; description: string; impact: string }) => ({
            type: c.type as AiDiagnosticCriterionType,
            label: c.label || '',
            description: c.description || '',
            impact: c.impact || '',
          }));
        diagnosticSummary = diagnosticJson.summary;
      } catch {
        criteria = [];
      }
    }

    return { reply, criteria, diagnosticSummary };
  }

  private getFallbackResponse(
    messages: AiChatMessage[],
  ): AiDiagnosticChatResponse {
    const lastUserMsg: AiChatMessage | undefined = [...messages]
      .reverse()
      .find((m: AiChatMessage) => m.role === 'user');
    const content: string = lastUserMsg?.content || '';

    let reply: string =
      '您好！我是农业诊断助手。为了更准确地判断作物情况，请您补充以下信息：\n\n1. 发病部位是哪里？（叶片/茎秆/根部/果实）\n2. 症状是什么样子？（发黄/斑点/卷曲/萎蔫等）\n3. 发生范围有多大？（零星几株/成片/整块地）\n4. 最近天气怎么样？（高温/多雨/干旱等）\n5. 近期有没有施肥、打药或浇水？\n\n补充这些信息后我可以给您更有针对性的建议。';

    const criteria: AiDiagnosticCriterion[] = [];

    const lower: string = content.toLowerCase();
    if (lower.includes('萎蔫') || lower.includes('打蔫') || lower.includes('卷')) {
      criteria.push({
        type: 'wilt',
        label: '疑似萎蔫症状',
        description: '用户描述叶片萎蔫/打蔫/卷曲',
        impact: '提示可能存在水分胁迫',
      });
      reply =
        '根据您描述的萎蔫症状，初步判断可能有以下几种原因：\n\n1. **缺水干旱**：土壤水分不足，作物吸水困难\n2. **高温灼伤**：气温过高，蒸腾作用太强\n3. **根部问题**：根系受损或病害导致吸水能力下降\n\n为了进一步判断，请告诉我：\n- 土壤是干的还是湿的？\n- 是整株萎蔫还是部分叶片？\n- 最近几天有没有浇水？气温多少度？\n\n补充后我可以给您更准确的建议。';
    } else if (lower.includes('黄') || lower.includes('发黄')) {
      criteria.push({
        type: 'nutrient',
        label: '疑似缺素症状',
        description: '用户描述叶片发黄',
        impact: '可能与营养元素缺乏有关',
      });
      reply =
        '根据您描述的发黄症状，可能的原因有：\n\n1. **缺氮**：整株叶片均匀发黄，下部老叶先黄\n2. **缺铁**：新叶发黄但叶脉仍绿\n3. **缺水/积水**：根系问题导致养分吸收受阻\n4. **病虫害**：某些病害也会引起黄化\n\n请补充以下信息：\n- 是新叶发黄还是老叶先黄？\n- 黄化是整片还是斑点状？\n- 最近施肥和浇水情况怎么样？';
    } else if (lower.includes('斑') || lower.includes('斑点')) {
      criteria.push({
        type: 'pest',
        label: '疑似病害症状',
        description: '用户描述叶片有斑点',
        impact: '可能为真菌或细菌性病害',
      });
      reply =
        '根据您描述的斑点症状，可能是真菌或细菌性病害。常见的有：\n\n1. **叶斑病**：圆形或不规则斑点，有明显边缘\n2. **锈病**：黄褐色锈斑，后期破裂散出锈粉\n3. **炭疽病**：凹陷的褐色病斑，上有黑色小点\n\n请补充：\n- 斑点是什么颜色？形状规则吗？\n- 主要在叶片正面还是背面？\n- 最近是不是多雨潮湿？';
    }

    return { reply, criteria, diagnosticSummary: '初步人工匹配结果（未调用AI）' };
  }

  private getCropName(cropType: string): string {
    const map: Record<string, string> = {
      maize: '玉米',
      wheat: '小麦',
      rice: '水稻',
      cotton: '棉花',
      soybean: '大豆',
      tomato: '番茄',
    };
    return map[cropType] || cropType;
  }
}
