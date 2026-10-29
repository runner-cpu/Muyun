# PROJECT · 牧云（Muyun）

## 当前状态

**Phase 3（美术）部分完成**：占位 Graphics 已替换为脚本生成的瓦片地图与动物精灵，
四季色罩、冬季雪粒子、畜群游走都已上线。DOM UI 的 impeccable 打磨留到 Phase 4。

- 日期：2026-10-29
- 分支：`feat/muyun`；校园版完整备份在 tag `campus-v0.1`
- 技术栈：Phaser 3.90 + TypeScript 5.9 + Vite 7 + Vitest 3
- 逻辑分辨率：480×270；瓦片 16×16；地图 40×30 瓦片
- 测试：94 个用例通过（sim 83 + 存档 6 + 日历 5）
- 构建：`tsc --noEmit` + `vite build` 通过，gzip JS ≈353 KB
- 浏览器实测：78fps、雪粒子、畜群动画、面板与事件卡均正常

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

## Phase 2 已完成

| 项目 | 状态 |
|---|---|
| 状态接入 | `GameState` 持有 `RunState`，所有读取与写入都走 `sim` 内核 |
| HUD | 周 / 季 / 钱 / 草 / 存栏 / 口碑 / 行动点 + 「结束本周」 |
| 畜群面板 | 50 头个体表（耳标、种类、性别、体重、BCS、状态）+ 请兽医 + 配种 |
| 草场面板 | 4 个小区现存量、承载力、退化条、放牧 / 割草 |
| 集市面板 | 按季节与体况估价的出售列表、买草 200/500 kg、雇工 |
| 科技面板 | 项圈、全群免疫、草场监测，含维护成本说明 |
| 事件卡 | 每周 55% 概率抽卡，12 张不重复，选项即时结算并写日志 |
| 结算页 | 5 种结局、四项统计、最近 8 条日志、「再来一局」 |
| 存档 | schema v2 保存整个 `RunState`，损坏字段钳制，旧档回退为新局 |

## Phase 3 已完成（美术部分）

| 项目 | 状态 |
|---|---|
| 公共像素库 | `tools/lib/pixel.mjs`：PNG 编码器、Canvas 原语、mulberry32 |
| 32 色板 | 高原冷色：钴蓝、草黄、雪白、墨黑牦牛、暖色木料 |
| 瓦片 | `ranch-tiles.png` 16 个：草地×4、土路×2、雪地×2、栅栏、木桩、花、干草、墙、屋顶、水 |
| 动物精灵 | `yak.png` / `sheep.png`，4 方向 × 2 帧 |
| 地图 | `RanchScene` 用 `make.tilemap` 代码生成 40×30 网格，栅栏/墙/水有碰撞 |
| 畜群实体 | 22 只动物在 4 个畜栏内游走，带两帧动画 |
| 季节表现 | 四季色罩 + 冬季雪粒子（`calendar:changed` 时开关） |

## 技术债 / 已知问题

- DOM UI 还没跑 impeccable 的 `polish` + `audit`；按钮对比度、移动端密度待打磨。
- 动物只有 2 帧 idle，没有真实行走动画；建筑用墙/屋顶瓦片拼，没有独立立面。
- 季节不会改变草地贴图（只有色罩和雪粒子）。
- 参考策略在 1.0× 载畜量下收入骤降，说明真人必须主动买草/减载；
  这是有意设计，但仍需真人试玩确认阈值是否过陡。
- Playwright headless 会把 rAF 限到 1 fps，测移动前需 `page.bringToFront()`。

## 下一步

1. **Phase 3 收尾**：impeccable `init` → `new-work` → `craft-floor` → `polish` + `audit`，打磨 DOM UI。
2. **Phase 4**：真机验收、部署、3 分钟演示视频、申报材料。

## 工程纪律（沿用）

- 单文件 < 300 行，接近上限先拆。
- 每次改动跑 `npx tsc --noEmit`、`npm test`、`npm run build`。
- 一次一个功能，一功能一 commit；改坏了 `git revert`，不硬修。
- 新想法进 `LATER.md`，不插队。
- 素材来源与许可证登记到 `ASSETS.md`。
