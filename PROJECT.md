# PROJECT · 牧云（Muyun）

## 当前状态

**Phase 1 完成**：`client/src/sim/` 畜牧模拟内核已跑通，13 周局状态机、12 张事件卡、
1000 局蒙特卡洛全部可用。Phase 0 的牧场场景仍是最小骨架，等待 Phase 2 接入。

- 日期：2026-10-29
- 分支：`feat/muyun`；校园版完整备份在 tag `campus-v0.1`
- 技术栈：Phaser 3.90 + TypeScript 5.9 + Vite 7 + Vitest 3
- 逻辑分辨率：480×270；瓦片 16×16；占位场景 40×30 瓦片
- 测试：92 个用例通过（sim 83 + 存档 4 + 日历 5）
- 构建：`tsc --noEmit` + `vite build` 通过，gzip JS ≈343 KB
- 蒙特卡洛：1000 局 / 4 档载畜量，输出 `reports/*.csv`

**核心结果**（`docs/SIMULATION.md`）：0.8× 载畜量平均收入 5.6 万、退化 0.37；
1.0× 收入跌到 1.0 万、退化 0.65；1.2× 全部生态崩溃。阈值曲线就是「草畜平衡」的证据。

## 方向

《牧云》是一款高原牧场经营游戏。一局 = 13 周（春 1–3、夏 4–6、秋 7–9、冬 10–13），
每周 2–3 个行动点，单局 30–45 分钟，5 种结局。

**D 版**（当前）：Roguelike 结构，短局、事件卡驱动、可重开。
**A 版**（后续）：连续时间、自由建造、多周目继承，复用同一套 `sim` 内核。

差异化：智慧畜牧不是数值加成，而是**花钱买信息**——项圈、疫情预警、草场监测
让玩家提前看到风险，正好对应牧区技术推广的真实困境。

## Phase 0 已完成

| 项目 | 状态 |
|---|---|
| 删除校园内容 | 52 个文件（7 段代码 1004 行、9 个数据 JSON、22 张建筑、校园地图、2 个工具、3 份地图、1 份文档） |
| 分支与备份 | tag `campus-v0.1`，分支 `feat/muyun` |
| 状态层 | `week / money / hayKg / labor / reputation`，删掉学分/心情/猫/签到/躲猫猫 |
| 日历 | `systems/Calendar.ts`：13 周 → 四季、季节色罩、周标签 |
| 存档 | schema v1，key `muyun-save-v1`，旧档重置出生点 |
| 场景 | `RanchScene`：占位草地、土路、4 个畜栏、暖棚、树、5 个触发器 |
| UI | HUD 改为周/季/钱/草/工/口碑；保留对话框、模态框、Toast、设置、摇杆 |
| 音频 | 保留 WebAudio 合成，`DayPhase` 改为 `Season` |
| 文档 | 旧校园方案归档到 `docs/archive/` |

## Phase 1 已完成

| 项目 | 状态 |
|---|---|
| `sim` 内核 | 12 个文件：types / rng / calendar / animal / nutrition / pasture / reproduction / disease / economy / weather / events / run |
| 个体模型 | Gompertz 生长曲线、BCS 1–5、体况驱动价格与繁殖 |
| 营养 | 干物质采食量按日计算（牦牛 2.5%、藏羊 3.5% BW），周需要量 ×7 ×1.1 |
| 草场 | 4 小区 × 2 ha、承载力羊单位、放牧取 60%、休牧按季节恢复、退化累积 |
| 繁殖 | BCS < 2.5 不发情、受胎率随体况上升、局末产犊 |
| 疫病 | 密度/季节/免疫影响爆发概率，SEIR 简化传播，治疗降低死亡 |
| 经济 | 活畜价格随体重/体况/季节、草价随季节与暴雪、周成本、5 种结局 |
| 事件 | 12 张卡、25 个选项、效果统一由 `applyEffect` 结算 |
| 局状态 | `createRun(seed, { herdScale })`、8 种周行动、`endWeek`、`summarize` |
| 测试 | `tests/sim/` 10 个文件 83 个用例，含确定性与重放 |
| 蒙特卡洛 | `npm run sim:monte` → `reports/monte-carlo.csv`、`reports/stocking-summary.csv` |

## 技术债 / 已知问题

- 牧场场景是程序化占位（Graphics + 生成纹理），不是 Tiled 地图；Phase 2 替换。
- 畜群 / 草场 / 集市 / 科技四个面板是占位弹窗；Phase 2 接 `sim` 内核。
- 场景内只加载 `player.png` 与 3 种树，没有动物精灵；Phase 3 由 `tools/gen-animals.mjs` 生成。
- 存档 schema v1 尚未包含 `RunState`；Phase 2 升到 v2。
- Playwright headless 会把 rAF 限到 1 fps，测移动前需 `page.bringToFront()`。
- 参考策略（每周放牧+割草+秋季卖 2 头）在 1.0× 载畜量下收入骤降，说明真人必须主动买草/减载；
  这是有意设计，但还需要真人试玩确认阈值是否过陡。

## 下一步

1. **Phase 2**：`RanchScene` 接 Tiled 牧场地图，四个面板接 `RunState`，事件卡上线，存档 v2。
2. **Phase 3**：32 色板、动物精灵、天气粒子；impeccable 打磨 DOM UI。
3. **Phase 4**：真机验收、部署、3 分钟演示视频、文档重写。

## 工程纪律（沿用）

- 单文件 < 300 行，接近上限先拆。
- 每次改动跑 `npx tsc --noEmit`、`npm test`、`npm run build`。
- 一次一个功能，一功能一 commit；改坏了 `git revert`，不硬修。
- 新想法进 `LATER.md`，不插队。
- 素材来源与许可证登记到 `ASSETS.md`。
