# ACCEPTANCE · Phase 0

日期：2026-10-29
分支：`feat/muyun`

## 自动化

| 项目 | 结果 |
|---|---|
| `npx tsc --noEmit` | 通过 |
| `npm test` | 9 / 9 通过（calendar 5 + save 4） |
| `npm run build` | 通过，gzip JS ≈343 KB，CSS ≈3.2 KB |

## 浏览器冒烟（Playwright + Chromium）

| 场景 | 结果 |
|---|---|
| 标题页渲染（高原日出、雪山、毡房、栅栏、牛群剪影） | 通过 |
| 控制台报错 | 0 |
| 点击「开始新的一局」进入牧场场景 | 通过 |
| HUD 显示「第 1 周 / 春季 / ¥12,000 / 草 800 kg / 工 2 / 口碑 50」 | 通过 |
| 按住 W 移动（y 269 → 191，约 78 px/s 符合 92 px/s 设定） | 通过 |
| 走到畜群触发器显示「查看畜群」提示 | 通过 |
| 按 E 打开「畜群」面板，关闭按钮可用 | 通过 |
| 页面隐藏时自动存档 | 通过（代码路径，未单独断言） |

**注意**：Playwright headless 默认把 rAF 限到 1 fps，测移动前必须
`page.bringToFront()`，否则位置不会变化。

## 未验收

- iOS Safari / Android Chrome 真机
- 触屏摇杆与互动按钮（DOM 结构保留，逻辑未改）
- 中端手机帧率
- 公网部署

## Phase 1 的验收标准

- `client/src/sim/` 9 个模块，禁止 import Phaser / DOM
- `npm test` ≥ 20 个用例
- `npm run sim:monte` 跑 1000 局并输出 `reports/monte-carlo.csv`
- 产出两张图：载畜量–收入分布、载畜量–草场退化概率
