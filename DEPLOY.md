# 灌溉决策平台 - 本地部署指南

## 项目概述

基于 NestJS + React + PostgreSQL 的农业灌溉决策系统，包含 AI 作物诊断助手。

### 已包含的功能模块
- 农场管理（农场信息、作物类型、土壤参数等）
- 灌溉决策（土壤墒情、气象数据、风险评估、灌溉计划）
- 历史记录（决策历史查询与查看）
- **AI 诊断助手**（悬浮对话组件、作物病害诊断、判据参与决策逻辑、对话历史持久化）

### 技术栈
- 前端：React 19 + TypeScript + Vite + TailwindCSS + shadcn/ui
- 后端：NestJS 10 + TypeScript + Drizzle ORM
- 数据库：PostgreSQL 14+
- AI：OpenAI 兼容接口（默认 DeepSeek，可切换任意兼容模型）

---

## 运行前提

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 22.0.0 | 推荐 22.x LTS |
| npm | >= 10.x | 随 Node.js 自带 |
| PostgreSQL | >= 14 | 必须，不支持 SQLite / MySQL |

> 注意：项目依赖 `@lark-apaas/fullstack-nestjs-core` 等妙搭平台 SDK，这些包在 npm registry 上可能不可用。如果 `npm install` 失败，说明需要从妙搭平台获取这些私有依赖。

---

## 快速开始

### 第一步：准备数据库

确保本地或服务器上有可用的 PostgreSQL：

```bash
# 创建数据库
createdb irrigation_db

# 执行建表脚本
psql -U postgres -d irrigation_db -f schema.sql
```

建表脚本 `schema.sql` 已包含在源码包根目录。

### 第二步：配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env，至少填入数据库连接串
vim .env
```

关键配置项：
- `SUDA_DATABASE_URL`：PostgreSQL 连接串（必填）
- `AI_API_KEY`：AI 模型密钥（可选，不填则 AI 诊断使用内置降级回复）

### 第三步：安装依赖

```bash
npm install
```

### 第四步：启动开发模式（前后端同时运行）

```bash
npm run dev
```

- 前端地址：http://localhost:5173
- 后端地址：http://localhost:3000
- API 前缀：`/api/*`

### 第五步（可选）：生产构建

```bash
# 构建前后端
npm run build:prod

# 启动生产服务
cd dist/server
node main.js
```

生产模式下前端由 NestJS 统一托管，访问 http://localhost:3000 即可。

---

## 环境变量完整清单

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `SUDA_DATABASE_URL` | ✅ | - | PostgreSQL 连接串，格式 `postgresql://user:pass@host:port/dbname` |
| `AI_BASE_URL` | ❌ | `https://api.deepseek.com/v1` | AI API 基础地址，OpenAI 兼容协议 |
| `AI_API_KEY` | ❌ | 空 | AI API 密钥；为空时 AI 诊断返回内置降级回复 |
| `AI_MODEL` | ❌ | `deepseek-chat` | AI 模型名称 |
| `SERVER_HOST` | ❌ | `localhost` | 服务监听地址 |
| `SERVER_PORT` | ❌ | `3000` | 服务监听端口 |
| `NODE_ENV` | ❌ | `development` | 运行环境：`development` / `production` |
| `LOG_DIR` | ❌ | `./logs` | 日志目录 |
| `LOG_REQUEST_BODY` | ❌ | `true` | 是否记录请求体 |
| `LOG_RESPONSE_BODY` | ❌ | `true` | 是否记录响应体 |

---

## 数据库说明

### 类型
- **PostgreSQL 14+**，不支持 SQLite / MySQL / MongoDB

### 建表方式
1. 使用包内提供的 `schema.sql` 手动执行（推荐，最简单）
2. 或者通过 Drizzle ORM 的 `drizzle-kit` 同步 schema（需额外配置）

### 数据表结构
- `farm` - 农场表，存储农场基本信息、作物、土壤参数
- `irrigation_decision` - 灌溉决策表，存储每次决策结果及 AI 诊断数据

### AI 相关字段（irrigation_decision 表）
- `ai_diagnostic_criteria` (JSONB) - AI 识别的诊断判据数组，每项含 type/label/description/impact
- `ai_diagnostic_summary` (TEXT) - AI 诊断摘要
- `ai_chat_messages` (JSONB) - 完整对话历史，含角色、内容、图片URL

### 自定义类型
- `user_profile` - 用户信息复合类型（本地部署可留空，不影响核心功能）
- `file_attachment` - 文件附件复合类型

> 本地单用户部署时，`_created_by`、`_updated_by` 等用户字段可为 NULL，不影响系统运行。RLS（行级安全）默认关闭。

---

## AI 诊断模块说明

### 位置
- 后端：`server/modules/ai-diagnostic/`
- 前端 API：`client/src/api/ai-diagnostic.ts`
- 前端组件：右下角悬浮对话按钮

### 工作原理
1. 用户在悬浮对话框中描述作物症状
2. 后端调用 AI 大模型（OpenAI 兼容接口）进行诊断
3. AI 返回自然语言回复 + 结构化诊断判据（JSON 格式）
4. 判据参与灌溉决策的风险等级调整
5. 对话历史与判据持久化到数据库

### 支持的判据类型
- `wilt` - 萎蔫卷曲
- `root_rot` - 根部病害烂根
- `heat_burn` - 叶片灼伤高温危害
- `pest` - 病虫害
- `nutrient` - 营养缺素
- `normal` - 长势良好

### 无 AI Key 时的降级
未配置 `AI_API_KEY` 时，AI 诊断模块自动降级为关键词匹配模式，依然可以使用，只是回复来自内置模板而非真实大模型。

---

## 目录结构

```
irrigation-decision-platform/
├── client/                # 前端 (React + Vite)
│   └── src/
│       ├── pages/         # 页面组件
│       │   ├── Dashboard/ # 首页仪表盘
│       │   ├── Farms/     # 农场管理
│       │   ├── Decision/  # 灌溉决策
│       │   └── History/   # 历史记录
│       ├── api/           # API 调用
│       │   └── ai-diagnostic.ts  # AI 诊断接口
│       └── components/    # 通用组件
├── server/                # 后端 (NestJS)
│   ├── modules/
│   │   ├── farm/          # 农场模块
│   │   ├── irrigation/    # 灌溉决策模块
│   │   ├── ai-diagnostic/ # AI 诊断模块 ⭐
│   │   └── view/          # 视图渲染
│   └── database/
│       └── schema.ts      # Drizzle schema 定义
├── shared/                # 前后端共享类型
├── schema.sql             # 数据库建表脚本
├── .env.example           # 环境变量示例
└── package.json
```

---

## 自托管去品牌化（妙搭痕迹清理）

本地自托管时默认会带妙搭平台痕迹，本项目已做清理：

| 痕迹 | 处理方式 | 位置 |
|------|---------|------|
| 页面标题「妙搭应用」 | ViewController 覆盖 appName/appDescription/showBadge | `server/modules/view/view.controller.ts` |
| Slardar / Tea / 飞书 performance 遥测外链 | 构建后正则剥离 | `scripts/strip-miaoda-traces.mjs`（已挂到 `build:client`） |
| 右下角「妙搭生成」悬浮徽标 | CSS 隐藏 + showBadge:false 双保险 | `client/src/index.css` |
| nginx `x-miaoda-custom-host` 头 | **保留**：框架用它判定 basename="/"，仅内网传递、用户不可见 | `/etc/nginx/sites-available/irrigation` |

注意：遥测脚本由 `@lark-apaas/coding-preset-vite-react` 在 vite 构建时注入，唯一官方关闭方式是
`MIAODA_BUILD_TARGET=standalone`，但该模式会改成 HashRouter 并跳过 NestJS HBS 渲染，不适合
本部署形态。因此每次 `build:client` 后会自动跑剥离脚本；若手动构建，记得执行
`node scripts/strip-miaoda-traces.mjs`。

---

## 常见问题

### Q: npm install 报找不到 @lark-apaas/* 包？
A: 这些是妙搭平台的私有 SDK。如果你是从妙搭平台导出的项目，这些依赖应该已在 `node_modules` 中。如需在全新环境安装，请联系妙搭平台获取私有 registry 配置。

### Q: 启动后数据库连接失败？
A: 检查 `.env` 中 `SUDA_DATABASE_URL` 是否正确，确认 PostgreSQL 服务已启动，数据库 `irrigation_db` 已创建。

### Q: AI 诊断没反应/一直转圈？
A: 检查 `AI_API_KEY` 是否配置正确，`AI_BASE_URL` 是否可达。未配置 key 时会走内置降级回复，但仍应在 1 秒内返回。

### Q: 生产环境前端静态资源 404？
A: 确保先执行了 `npm run build:client`，前端构建产物在 `dist/client/` 目录下，由 NestJS 的 ViewModule 托管。
