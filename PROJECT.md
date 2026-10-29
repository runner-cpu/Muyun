# PROJECT · 牧云（Muyun）

## 当前状态

**Phase 0 完成**：校园内容已全部移除，工程骨架替换为牧场题材的最小可运行版本。
标题页 → 牧场场景 → 移动 / 靠近提示 / E 键打开面板，整条链路可用。

- 日期：2026-10-29
- 分支：`feat/muyun`；校园版完整备份在 tag `campus-v0.1`
- 技术栈：Phaser 3.90 + TypeScript 5.9 + Vite 7 + Vitest 3
- 逻辑分辨率：480×270；瓦片 16×16；占位场景 40×30 瓦片
- 测试：9 个用例通过（存档迁移 4 + 牧场日历 5）
- 构建：`tsc --noEmit` + `vite build` 通过，gzip JS ≈343 KB
- 浏览器实测：标题页、场景渲染、WASD 移动、交互提示、面板弹窗均正常

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

## 技术债 / 已知问题

- 牧场场景是程序化占位（Graphics + 生成纹理），不是 Tiled 地图；Phase 2 替换。
- 畜群 / 草场 / 集市 / 科技四个面板是占位弹窗；Phase 2 接入 `sim` 内核。
- 场景内只加载 `player.png` 与 3 种树，没有动物精灵；Phase 3 由 `tools/gen-animals.mjs` 生成。
- 项目名仍是 `pixel-campus-client`（`client/package.json`），Phase 4 统一改名。
- Playwright headless 会把 rAF 限到 1 fps，测移动前需 `page.bringToFront()`。

## 下一步

1. **Phase 1**：`client/src/sim/` 内核（9 模块）+ 20 个单测 + 蒙特卡洛脚本。
2. **Phase 2**：`RanchScene` 接 Tiled 牧场地图，四个面板接真实数据，事件卡上线。
3. **Phase 3**：32 色板、动物精灵、天气粒子；impeccable 打磨 DOM UI。
4. **Phase 4**：真机验收、部署、3 分钟演示视频、文档重写。

## 工程纪律（沿用）

- 单文件 < 300 行，接近上限先拆。
- 每次改动跑 `npx tsc --noEmit`、`npm test`、`npm run build`。
- 一次一个功能，一功能一 commit；改坏了 `git revert`，不硬修。
- 新想法进 `LATER.md`，不插队。
- 素材来源与许可证登记到 `ASSETS.md`。
