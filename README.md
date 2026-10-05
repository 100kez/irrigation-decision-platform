# 智慧灌溉决策平台

基于 **FAO-56 蒸散模型**的精准灌溉决策支持系统。用户录入田间观测数据后,平台结合未来 7 天天气预报进行逐日水量平衡模拟,给出「是否需要灌溉、何时浇、浇多少」的建议,并支持方案从采纳、调整到实际执行的完整追踪。

线上地址:https://irrigation.bddog.cn

## 功能模块

| 模块 | 说明 |
|------|------|
| 首页概览 | 时间范围统计(建议水量 / 实际执行水量分列)、待处理建议、农田状态卡(当前水分 / 24h 预测水分 / 水分状态 / 缺水风险) |
| 农田管理 | 农田档案维护,生育阶段自动推算、数据接入状态与最新水分状态展示,支持名称搜索与状态筛选 |
| 灌溉决策 | 自动获取(回填最近观测)/ 人工录入双模式;结果四段式:①建议动作 → ②判断依据 → ③图表详情(实测 vs 预测 + 阈值参考线)→ ④方案操作 |
| 历史记录 | 方案状态筛选(待确认 / 已采纳 / 已执行 / 暂不执行 / 已替代)、计划与实际执行分列、最新有效方案标记、完整决策复盘详情 |

### 方案状态流转

```
生成 → 待确认(pending)
        ├─ 采纳建议 → 已采纳(adopted)
        │              ├─ 记录执行 → 已执行(executed,可多次追加)
        │              └─ 暂不执行 → 暂不执行(rejected,可改回)
        └─ 暂不执行 → 暂不执行(rejected)

同一农田生成新方案时,旧的待确认/已采纳方案自动标记为 已替代(superseded)
```

采纳(认可方案)与执行(实际灌溉)是不同状态;执行时记录真实时间与水量,水量缺省按农田面积自动换算 m³。

## 技术栈

- **框架**:妙搭(Lark APaaS)fullstack-nestjs-template 2.3.0
- **后端**:NestJS + Drizzle ORM + PostgreSQL 14+,Node ≥ 22
- **前端**:React 18 + Vite + Tailwind CSS + shadcn/ui 风格组件 + Recharts
- **天气数据**:Open-Meteo 免费 API(未来 7 天预报,随决策快照落库)
- **AI 诊断**:OpenAI 兼容协议(默认 DeepSeek),输出诊断判据辅助修正风险等级与灌溉计划;无 API Key 时自动降级为关键词匹配

技术路线:灌溉计划由 **FAO-56 蒸散规则引擎**(7 天水量平衡)计算,AI 诊断判据负责辅助修正,两者在界面上分栏标注。

## 目录结构

```
├── client/                 # React 前端
│   └── src/
│       ├── pages/          # Dashboard / Farms / Decision / History 四个页面
│       ├── components/     # ui 组件库 + 业务组件
│       ├── api/            # 后端接口封装
│       └── lib/            # decision-visual(状态徽章配色/图标)
├── server/                 # NestJS 后端
│   ├── modules/
│   │   ├── farm/           # 农田 CRUD
│   │   ├── irrigation/     # 决策计算、状态机、执行记录、首页聚合
│   │   ├── ai-diagnostic/  # AI 诊断判据(DeepSeek)
│   │   └── view/           # SSR 页面渲染
│   └── database/schema.ts  # Drizzle schema(由数据库反向生成)
├── shared/                 # 前后端共享
│   ├── api.interface.ts    # API 类型契约
│   └── decisionMeta.ts     # 状态枚举、中文文案、派生规则(唯一来源)
├── schema.sql              # 建库脚本(含自定义复合类型)
└── DEPLOY.md               # 部署与运维文档
```

## 快速开始

### 环境准备

```bash
# 1. 安装依赖(Node ≥ 22)
npm install

# 2. 配置环境变量(参考 .env.example)
cp .env.example .env
# SUDA_DATABASE_URL=postgresql://user:password@localhost:5432/irrigation_db
# AI_API_KEY 留空则 AI 诊断使用内置降级回复

# 3. 初始化数据库
psql -U <user> -d <database> -f schema.sql
```

### 本地开发

```bash
npm run dev          # 同时启动前后端(见 scripts/dev.sh)
# 或分开:
npm run dev:server   # NestJS,默认 3000 端口
npm run dev:client   # Vite,默认 5173 端口
```

### 生产构建与运行

```bash
npm run type:check          # 构建前先做静态类型检查(nest build 不开 typeCheck)
npm run build:prod          # 等价于 build:server && build:client
cd dist/server && node main.js
```

> ⚠️ 注意:不要使用 `npm run build`(build.sh 会卡在 `fullstack-cli action-plugin init` 交互提示)。
> `build:client` 会自动运行 `scripts/strip-miaoda-traces.mjs` 剥离遥测外链。

## 核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/irrigation/decide` | 生成灌溉决策(计算 + 落库,同田旧方案自动置为已替代) |
| GET | `/api/irrigation/dashboard?range=all\|7d\|30d` | 首页聚合(统计、农田状态、待处理建议、最近决策) |
| GET | `/api/irrigation/decisions` | 决策列表(支持 farmId/status/sort/dateFrom/dateTo/分页) |
| GET | `/api/irrigation/decisions/:id` | 决策详情 |
| PATCH | `/api/irrigation/decisions/:id/status` | 方案状态流转(adopted/rejected) |
| POST | `/api/irrigation/decisions/:id/execution` | 记录实际执行(可多次追加) |
| PUT | `/api/irrigation/decisions/:id/plan` | 保存人工调整后的方案 |
| GET | `/api/irrigation/weather?lat=&lon=` | 查询天气预报 |
| CRUD | `/api/farms` | 农田管理(列表附带每田最新决策摘要) |
| POST | `/api/ai-diagnostic/chat` | AI 诊断对话 |

所有 `/api/*` 请求受 CSRF 保护:需携带 `suda-csrf-token` Cookie 与 `x-suda-csrf-token` 请求头(客户端 axios 自动注入)。

## 数据模型

- `farm`:农田档案(经纬度、作物、播种日期、土壤、面积、灌溉方式,以及田间持水量 / 萎蔫点 / 胁迫阈值三项管理阈值)
- `irrigation_decision`:决策记录快照(4 项田间观测值、天气快照、逐日水量平衡、风险等级、灌溉计划、AI 判据、`status` / `execution_records` / `adjusted_plan` / `ai_model`)

统一状态与文案定义在 `shared/decisionMeta.ts`(前后端共用):

- 水分状态:偏湿 / 适宜 / 偏干 / 胁迫(基于当前含水率与管理阈值)
- 缺水风险:低 / 中 / 高 / 数据不足(基于预期胁迫日期)
- 生育阶段:苗期 / 发育期 / 中期 / 后期(播种后 20/50/90/120 天分段)

## 部署

见 [DEPLOY.md](./DEPLOY.md):nginx 反代 + systemd 托管 + Let's Encrypt HTTPS 的完整步骤与常见问题。

## 更新记录

### 2026-10-05 调试阶段改版

围绕「用户能看懂农田情况、完成一次决策、追踪方案的处理和执行状态」重构四个页面,并新增方案状态流转后端能力。

**数据库**(幂等 ALTER,详见 `schema.sql`)

- `irrigation_decision` 新增 4 列:`status`(方案五态)、`execution_records`(实际执行记录)、`adjusted_plan`(调整后方案)、`ai_model`(生成时的 AI 模型)

**后端**

- 新增端点:`GET /api/irrigation/dashboard?range=all|7d|30d`(首页聚合)、`PATCH /decisions/:id/status`、`POST /decisions/:id/execution`、`PUT /decisions/:id/plan`
- 状态机:待确认/已采纳/已执行/暂不执行/已替代;已执行与已替代方案受保护(409);执行记录可多次追加,m³ 缺省按面积自动换算
- 同农田生成新决策时,旧的待确认/已采纳方案在同一事务内自动置为已替代
- 决策列表支持 `status` / `dateFrom` / `dateTo` / `sort` 筛选(修复原排序参数未生效的 bug)
- 农田列表附带每田最新决策摘要(selectDistinctOn 子查询)

**前端**

- 首页概览:统计增加时间范围(全部/近 7 天/近 30 天),建议水量与实际执行水量分列(替换原抽样估算);新增待处理建议清单与农田状态卡(当前水分/24h 预测/水分状态/缺水风险/更新时间);使用提示改为可折叠
- 农田管理:英文枚举(corn/loam/drip 等)统一映射中文;卡片新增生育阶段/数据接入状态/最新数据时间/最新水分状态;按钮按去向命名(生成决策/查看最新决策/查看监测);新增名称搜索与水分状态筛选;修复列表超过 10 块田被截断的问题
- 灌溉决策:农田选择压缩为顶部横条;数据获取支持自动(回填最近观测快照,标注来源/观测时间/测量深度/单位)与人工两种方式,自动填入后被修改的值保留修改记录;右侧空状态改为数据准备说明清单;结果重组为四段式——①建议动作(含暂不灌溉)→ ②判断依据(FAO-56 与 AI 判据分栏)→ ③图表详情(Recharts:实测点、7 天预测线、胁迫阈值/萎蔫点参考线)→ ④方案操作(采纳建议/调整计划/暂不执行/记录执行);支持 `?farmId=` 与 `?decisionId=` 直达;切换农田自动清空结果与输入
- 历史记录:新增状态徽章、计划灌溉与实际执行分列、最新有效方案标记;筛选增加方案状态与日期范围,支持 `?farmId=` 直达;详情增加执行记录、调整后方案对照、计算方法(FAO-56 规则引擎 v1)与 AI 模型版本
- 统一文案:水分状态(偏湿/适宜/偏干/胁迫)、缺水风险(低/中/高/数据不足)、风险等级与方案状态的中文文案收敛到 `shared/decisionMeta.ts`,配色图标收敛到 `client/src/lib/decision-visual.ts`,删除页面内三处重复定义

**Bug 修复**

- 新增农田时播种日期为空导致 PostgreSQL `date` 类型报错 500(服务端兜底为当天,DTO 改为可选)
- 历史记录排序参数被前端丢弃,实际未生效
