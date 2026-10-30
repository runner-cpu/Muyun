# 牧云决策训练与策略实验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在像素牧场中完成目标、信息、动作、后果、策略对照的闭环。

**Architecture:** 纯 TypeScript 模拟提供共享规则、记录、评价、试算与策略；Phaser 保留牧场场景，DOM 面板消费真实状态。完整局和挑战独立存档，旧档从续玩起点开始记录。

**Tech Stack:** Phaser 3.90、TypeScript、Vite、Vitest。

**Spec:** docs/superpowers/specs/2026-10-30-muyun-decision-game-design.md

## Global Constraints

- 保留现有像素牧场、人物与动物美术，沿用深绿、灰绿与暖土色界面。
- 保持现有 schema v2，显式校验新增字段及数组长度。
- 完整十三周局与四周挑战均在完局后才展示对照，避免泄漏未来事件。
- 预测函数为纯函数，不能改变草量、行动或存档。
- 当前 AI 美术来源继续保留。
- 不提交已有混合工作树；本次授权为实现与本地验证，无外部发布。

## 任务与契约

### Task 1：共享状态、记录、规则和确定错误（主代理）

**Files:** sim/types.ts、rules.ts、history.ts、run.ts、settlement.ts、reproduction.ts、economy.ts、events.ts。

**Interfaces:**

```ts
actionStatus(state: RunState, action: Action): { cost: number; reason: string | null }
actionLimit(state: Pick<RunState, 'labor'>): number
captureMetrics(state: RunState): RunMetrics
ensureTracking(state: RunState): RunState
recordDecision(before: RunState, after: RunState, decision: Decision): RunState
settleDeterministic(state: RunState): RunState
```

- [x] 先加回归测试：离栏孕母不能产仔，雇工下周增加 AP，重复设备不能扣费，事件不能无钱支付或重复领取。
- [x] 新增可选 RunTracking（origin、baseline、weeks、pending）、ScenarioId、退出原因；origin 排除 tracking。
- [x] 引擎与面板共享费用/资格，复制修改的嵌套状态，按实际项圈存栏计费。
- [x] 拆出确定性饲喂、生长、休牧、成本阶段，天气疫病仍仅实际结算执行；记录四季使命所需真实动作。
- [x] 完成对应测试，保留用户其他修改。

### Task 2：评价、目标、监测和场景（并行代理 A）

**Files:** 新增 assessment.ts、objectives.ts、insights.ts、scenarios.ts；新增对应 tests。

**Interfaces:**

```ts
assessRun(state: RunState): Assessment
seasonObjectives(state: RunState): SeasonObjective[]
pastureInsights(state: RunState): PastureInsight[]
collarInsights(state: RunState): CollarInsight[]
createWinterChallenge(): RunState
```

- [x] 写不修改源状态、空栏评分为零、季末真实条件、挑战起点与设备维护的测试。
- [x] 按 spec 公式输出原始指标、三维评分、最高成果资格；所有数值由真实状态计算。
- [x] 草场预测调用真实 graze/rest，项圈仅显示已佩戴趋势；没有历史显示首次记录。
- [x] 四周挑战固定 20261030、第 10 周开始；预设完成后 ensureTracking。
- [x] 完成模块测试并报告接口与证据。

### Task 3：搜索、对照与导出（并行代理 B）

**Files:** 新增 planner.ts、policies.ts、replay.ts、scripts/strategy-benchmark.ts、tests/planner.test.ts。

**Interfaces:**

```ts
planWeek(state: RunState): PlanResult
comparePolicies(state: RunState): PolicyComparison
exportRun(state: RunState): string
```

- [x] 写约束、源状态不变、节点上限、确定性和回放一致性测试。
- [x] beam width 24、AP 最多五层、节点最多十四候选；先安全可行再按公开目标评分。
- [x] 预测只调用 settleDeterministic，不读取未来天气；设备未开通返回锁定原因。
- [x] 同 origin、seed 与事件顺序对照；未装监测的搜索策略先真实付费安装，否则回退基线。
- [x] 运行三十种 seed 基准，输出真实 CSV/JSON 与耗时，不预设算法胜出。

### Task 4：经营面板和复盘体验（并行代理 C）

**Files:** ui/panels/overview.ts、tech.ts、pasture.ts、herd.ts、result.ts、guide.ts；新增 strategy.ts、reviewView.ts、decision.css。

- [x] 概览优先显示目标和风险；监测/项圈在原面板给出真实收益。
- [x] 搜索展示序列、代价、依据和模拟边界，不自动执行；锁定态给出开通入口。
- [x] 结果页显示三维成果、使命与逐周表；完局后执行对照与 JSON 导出。
- [x] 使用既有颜色与 modal，键盘可操作，表格可横向滚动，所有内容 escapeHtml。
- [x] 不修改 TitleScene、UIManager、SaveSystem、GameState、HUD、WeekFlow；主代理负责这些集成。

### Task 5：存档、挑战入口与周流程（主代理）

**Files:** SaveSystem.ts、trackingSave.ts、GameState.ts、defaultState.ts、TitleScene.ts、UIManager.ts、HudView.ts、WeekFlow.ts、index.html、panelActions.ts。

- [x] 两个存档键，标题可进入/续玩挑战；重开与退出保留另一模式。
- [x] 保存新字段并显式清洗；v2 原进度保留；旧档 ensureTracking 从续玩起点记录。
- [x] HUD 与周流程动态行动上限；拒绝事件不能关闭未决窗口或标记已完成。
- [x] 测试往返、旧档、挑战四次结束与未决事件恢复。

### Task 6：整体验证、基准、文档和独立复核

- [x] `npm test` 与 `npm run build`；修改失败处后仅重复必要检查。
- [x] `npm run sim:strategies`（vite-node） 与原蒙特卡洛，记录真实结果。
- [x] 更新 PRODUCT/PROJECT/DESIGN/SIMULATION、README、演示脚本与赛事适配说明。
- [x] 真实浏览器完整流程：标题→挑战→目标→监测→策略→执行→四次结算→对照→导出→重载续档；桌面/窄横屏批量检查。
- [x] 独立代理复核规则与 UI，集中修复后完成复查。

## 执行记录

- 2026-10-30：用户确认推荐定位；已读 spec，按本计划连续执行。
- Ruling: 在当前共享目录分配互不重叠文件，不创建新工作树 — 现有 UI/美术修改是本轮玩法的基底 — 错误时可逐文件回退本轮差异，避免丢失已有工作。
- Ruling: 不按技能惯例提交混合工作树 — 未提交内容包括前轮用户授权工作 — 保留所有改动供最终审阅。

- 2026-10-30 完成：28文件191测试、TypeScript/Vite构建通过；1000局原蒙特卡洛和两场景各30 seed策略基准完成。真实四周挑战、手动策略、对照、下载后回放、独立存档与窄横屏验收通过。核心与UI独立复核均PASS，原P2已关闭。完整证据见 `output/review/decision-acceptance.md`。
