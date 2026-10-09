# 2026-10-09 手机端响应式适配

站点:https://irrigation.bddog.cn(同一网址自适应,桌面端布局保持不变)

## 改动范围

- **外壳**:`Layout.tsx` 重写 — <768px 显示顶部标题栏(汉堡按钮 + 平台名),汉堡打开 Sheet 左侧抽屉(导航 + 用户信息,点击导航自动收起);≥768px 保持原 240px 侧栏。根容器 `h-screen w-screen` → `h-dvh w-full flex-col md:flex-row`(适配手机动态地址栏)。导航内容抽成 `SidebarNavContent` 供侧栏与抽屉共用。
- **AI 助手**:`AiDiagnosticChat.tsx` — 手机端面板近全屏(`max-sm:inset-x-2 + top/bottom 锚定 + h-auto w-auto`),气泡 `max-w-[72%]`,FAB 底部加 `env(safe-area-inset-bottom)` 避让。
- **断点约定**:基类 = 手机(<640),`sm:` 恢复桌面,`md:` 控制侧栏显隐,`max-sm:` 仅手机覆盖。≥768px 生成样式与改版前等价,桌面无回归。
- **页面清单**:
  - Dashboard:时间范围选择器手机全宽;农田卡片内层统计改单列
  - Farms:搜索框手机全宽;卡片/骨架网格改 `grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]`(桌面行为与原先 inline style 一致,窄屏不再溢出);新增/编辑表单与监测快照单列
  - Decision:观测输入单列;调整计划弹窗 5 列行改手机卡片式(日期+删除 / 两水量 / 原因整行);图表胁迫阈值标签移左下、X 轴字号 11
  - History:筛选区手机 2 列网格;记录行手机 2 列 + 操作整行;详情弹窗基本信息/天气单列;方案与执行记录行改 `[2.5rem_1fr]` 网格
- **基础设施**:`client/index.html` viewport 加 `viewport-fit=cover`;`tailwind-theme.css` 增 `.pt-safe/.pb-safe/.pl-safe/.pr-safe`(max() 保证非刘海机不变)
- 未改:路由、服务端、ui/sheet 等组件;未新增依赖

## 构建与发布

```bash
npm run type:check    # 全过
npm run build:client  # 新 bundle index-Cm5XaQnr.js / index-CnxDlHmd.css
npm run build:server
systemctl restart irrigation
```

## 待真机验证清单
1. 手机(320~430px):顶部标题栏出现、左侧栏消失;汉堡抽屉正常开关、点导航收起
2. 桌面(≥768px):与改版前完全一致
3. 各页无横向滚动(scrollWidth ≤ innerWidth)
4. AI 面板近全屏、气泡不溢出;iPhone 刘海下标题栏/AI 面板避让安全区
5. 农田表单单列、决策调整计划卡片式行、历史筛选 2 列 + 列表 2 列
6. 右下角无「妙搭生成」徽标(手机端已修复,见下)

## 追加修复:「妙搭生成」徽标在手机上仍显示

- 原因:框架手机端是独立的 `MobileWatermark` 组件,`data-custom-element` 为 `miaoda-watermark-mobile`,不匹配 index.css 原有 `$="-watermark"` 后缀选择器(只隐藏了桌面端 `miaoda-watermark`)
- 修复:`index.css` 选择器改为 `[data-custom-element*="-watermark"]` 包含匹配,同时覆盖两种徽标(框架内仅这两个值,无误伤)
- 验证:新 CSS `index-C-fBHdhW.css` 已上线,手机强刷后生效

## 备忘

- Tailwind 任意值类在 dist CSS 中是转义形式(如 `grid-cols-\[2\.5rem_1fr\]`),grep 验证时注意转义
- 桌面不回归的保障:全部改动是断点变体或等价替换(`w-60`=240px、`h-dvh`=100vh、`minmax(min(100%,340px),1fr)` 在宽容器下与旧 inline style 恒等)
