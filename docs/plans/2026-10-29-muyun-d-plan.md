# 《牧云》D 版实施计划

> 目标：6 周内交付可完整游玩的 D 版（13 周一局、5 种结局、12 张事件卡），
> 能直接参加计算机设计大赛，并作为创赛的技术底稿。A 版在其后扩展。

## 总策略

2026-10-30 状态同步：Phase 0-3 的核心实现已接入，经营框架与视觉重构详见 `2026-10-30-interface-redesign.md`。以下保留原阶段目标，并在各阶段标明当前实现与差距；发布和真机验收仍待完成。

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

当前：个体、营养、草场、繁殖、疾病、经济、天气、事件与局状态内核已完成并接入游戏。按种子重放与批量仿真脚本已存在，原计划中的图表目标不在本次同步中判定完成。

位置 `client/src/sim/`，硬规则：禁止 import Phaser / DOM；随机数通过注入的 `Rng`。

| 文件 | 职责 |
|---|---|
| `rng.ts` | mulberry32 确定性随机 |
| `types.ts` | `Animal` `PastureCell` `RunState` `Action` `EventCard` `Ending` |
| `animal.ts` | 个体模型、体重变化、BCS 1–5、健康状态 |
| `nutrition.ts` | 干物质采食量（牦牛 2.5% BW / 羊 3.5% BW）、草料消耗 |
| `pasture.ts` | 4 个小区、生物量、承载力（羊单位）、轮牧恢复、退化 |
| `reproduction.ts` | 配种成功率受 BCS 约束（<2.5 不发情）、局末产犊结算 |
| `disease.ts` | 存栏与季节影响传入概率，按周简化处理感染、恢复与死亡 |
| `economy.ts` | 成本、出栏价季节波动、雪灾时草料涨价 |
| `weather.ts` | 季节曲线、降雪、雪灾概率 |
| `events.ts` | 12 张事件卡的抽取与结算 |
| `run.ts` | 局状态 `createRun / applyAction / endWeek / summarize`，结局由经济模块评估 |

**出口标准**：`sim.test.ts` ≥ 20 用例；`npm run sim:monte` 跑 1000 局输出
`reports/monte-carlo.csv`；两张图（载畜量–收入分布、载畜量–退化概率）。

## Phase 2 · 游戏外壳（第 3–4 周，约 40 小时）

- [x] 40×30 双图层牧场，由程序化数据构建；尚未切换到独立 Tiled 地编文件
- [x] 畜群、草场、集市、科技四个经营面板
- [x] 事件卡弹窗与选择结算
- [x] `GameState` 持有 `RunState`，UI 读取投影并派发 Action
- [x] 存档 schema v2
- [x] 四入口和 `1-4` 快捷键、本周概览、动作校验与完整个体分页
- [x] 周结算确认、经营回顾、新版存档未决事件恢复

## Phase 3 · 美术与 UI（第 5 周，约 25 小时）

- [x] `tools/lib/pixel.mjs` 公共像素库
- [x] `tools/theme.mjs` 统一色板
- [x] `tools/gen-sprites.mjs` 牦牛、藏羊与牧人四方向精灵
- [x] `tools/gen-terrain.mjs` 四季草地、道具、栅栏与雪地
- [x] `tools/gen-structures.mjs` 独立谷仓与院落道具；其他建筑可按后续需要扩展
- [x] 冬季天气粒子、季节色罩、四季瓦片和树木变化
- [x] 标题高原图、自托管字体、晨光/暮色工具主题与界面层级重构
- [x] PRODUCT.md、DESIGN.md、设计 sidecar、surface brief 与素材来源记录
- [x] 2026-10-30 浏览器经营流程、弹窗键盘与多视口布局验证；17 文件、123 测试及类型、构建通过
- [x] 独立视觉审查结论 `ship`，无重大开放项；详见 `2026-10-30-interface-redesign.md`
- [x] 标题页音量调整保护已有 run 存档的收尾修复与单元、浏览器回归验证
- [ ] 真机性能验收，以 `2026-10-30-interface-redesign.md` 的收尾记录为准

## Phase 4 · 验收与发布（第 6 周，约 22 小时）

- [ ] 真机横屏、首屏体积与性能目标验收，不沿用旧环境结论
- [ ] 公网部署验收；仓库已有 GitHub Pages / Netlify 配置
- [ ] 3 分钟演示视频
- [x] README、PROJECT、ASSETS 与本轮界面实施计划同步

后续按三个阶段推进：科技真实信息输出、存档嵌套结构深校验、真机性能与经营平衡。具体范围见 `2026-10-30-interface-redesign.md`，不把本轮界面重构当作这些能力已完成的证明。

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
