# 《牧云》D 版实施计划

> 目标：6 周内交付可完整游玩的 D 版（13 周一局、5 种结局、12 张事件卡），
> 能直接参加计算机设计大赛，并作为创赛的技术底稿。A 版在其后扩展。

## 总策略

1. **不重写，换内容层。** 3007 行中 1971 行是通用引擎，保留；1004 行校园内容删除。
2. **每个 commit 保持可构建。**
3. **先内核，后外壳。** `sim` 纯逻辑先跑通并出蒙特卡洛图，再谈美术。
4. **git 历史是安全网。** tag `campus-v0.1`。

## Phase 0 · 归档与清理（完成）

- tag `campus-v0.1`，分支 `feat/muyun`
- 删除 52 个校园文件
- 替换为最小可运行牧场骨架
- 验收：`tsc` + `npm test` + `npm run build` 全绿

## Phase 1 · sim 内核（第 1–2 周，约 32 小时）

位置 `client/src/sim/`，硬规则：禁止 import Phaser / DOM；随机数通过注入的 `Rng`。

| 文件 | 职责 |
|---|---|
| `rng.ts` | mulberry32 确定性随机 |
| `types.ts` | `Animal` `PastureCell` `RunState` `Action` `EventCard` `Ending` |
| `animal.ts` | 个体模型、体重变化、BCS 1–5、健康状态 |
| `nutrition.ts` | 干物质采食量（牦牛 2.5% BW / 羊 3.5% BW）、草料消耗 |
| `pasture.ts` | 4 个小区、生物量、承载力（羊单位）、轮牧恢复、退化 |
| `reproduction.ts` | 配种成功率受 BCS 约束（<2.5 不发情）、局末产犊结算 |
| `disease.ts` | 密度/应激/外来动物触发的 SEIR 简化模型 |
| `economy.ts` | 成本、出栏价季节波动、雪灾时草料涨价 |
| `weather.ts` | 季节曲线、降雪、雪灾概率 |
| `events.ts` | 12 张事件卡的抽取与结算 |
| `run.ts` | 状态机 `createRun / applyAction / advanceWeek / evaluateEnding` |

**出口标准**：`sim.test.ts` ≥ 20 用例；`npm run sim:monte` 跑 1000 局输出
`reports/monte-carlo.csv`；两张图（载畜量–收入分布、载畜量–退化概率）。

## Phase 2 · 游戏外壳（第 3–4 周，约 40 小时）

- `RanchScene` 换成 Tiled 牧场地图（40×30）
- 四个面板：`HerdPanel` `PasturePanel` `MarketPanel` `TechPanel`
- 12 张事件卡与 `EventCard` 弹窗
- `GameState` 持有 `RunState`，UI 只读快照 + 派发 Action
- 存档 schema v2

## Phase 3 · 美术与 UI（第 5 周，约 25 小时）

- `tools/lib/pixel.mjs` 抽公共库
- `tools/theme/ranch.json` 32 色板
- `tools/gen-animals.mjs` 牦牛、藏羊
- `tools/gen-assets.mjs` 扩展草地/雪地/栅栏
- `tools/gen-structures.mjs` 暖棚、谷仓、棚圈
- impeccable：`context.mjs` → `init` → `new-work` → `craft-floor` → `polish` + `audit`
- 天气粒子与季节色罩

## Phase 4 · 验收与发布（第 6 周，约 22 小时）

- 真机横屏、首屏 < 3 MB、60fps
- 部署 GitHub Pages / Netlify
- 3 分钟演示视频
- 文档重写

## 技能使用

| 阶段 | 技能 |
|---|---|
| 全程 | `writing-plans` |
| Phase 1 | `test-driven-development` |
| Phase 3 | `impeccable` |
| 每阶段末 | `verification-before-completion` |
| 卡住时 | `systematic-debugging` |
| 可并行时 | `dispatching-parallel-agents` |

## 三条防重演规则

1. 不复刻真实地理。
2. 有限色板 + 色彩脚本。
3. 每 3 天必须有一个可玩版本。
