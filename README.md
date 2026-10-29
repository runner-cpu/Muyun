# 牧云 · Muyun

打开网页就能玩的高原牧场经营游戏。一局十三个星期，草畜之间做取舍。

> v0.1 骨架：Phase 0 已完成，牧场场景可走、可交互，畜群/草场/集市/科技面板待接入。

## 快速开始

```bash
cd client
npm install
npm run dev
```

打开 `http://localhost:5173`。

生产构建：

```bash
cd client
npm run build
npm run preview
```

## 操作

- 桌面：`WASD` / 方向键移动，`E` / 空格互动，`Esc` 设置。
- 手机：横屏，左下虚拟摇杆，右下「互动」按钮；靠近目标也可以直接点黄色标记。

## 当前已实现

- Phaser 3 + TypeScript + Vite；逻辑分辨率 480×270，16×16 瓦片，整数缩放。
- 标题页：程序化高原日出、雪山、毡房、栅栏与牛群剪影。
- 牧场场景：40×30 瓦片占位地图，4 个畜栏、暖棚、干草堆、土路与树。
- 玩家移动、相机跟随、交互触发器与提示、DOM 面板、Toast、设置。
- 13 周牧场日历：春 1–3、夏 4–6、秋 7–9、冬 10–13，季节色罩与 HUD。
- 状态：钱、草料、人手、口碑；存档 schema v1 + 迁移与边界校验。
- WebAudio 程序化 BGM / 音效，无外部音频版权负担。
- 9 个单元测试：存档迁移 4 + 牧场日历 5。

## 项目结构

```
client/
  src/
    core/          GameState / defaultState / emitter
    sim/           （Phase 1）纯逻辑畜牧模拟内核，禁止 import Phaser
    systems/       Input / Interaction / Save / Calendar / Audio / Dialogue
    scenes/        Boot / Preload / Title / Ranch
    entities/      Player / Npc
    world/         Trees
    ui/            UIManager / dialoguebox / joystick
  tests/           calendar / save
tools/             程序化像素素材与地图生成脚本
docs/              决策、验收、归档
```

## 测试

```bash
cd client
npm test
npm run build
```

## 部署

`vite.config.ts` 使用 `base: './'`，可部署到 Vercel、Netlify 或 GitHub Pages：

- Vercel：Root Directory 选 `client`，Build Command `npm run build`，Output `dist`。
- Netlify：`netlify.toml` 已配置 `base = "client"`。
- GitHub Pages：`.github/workflows/pages.yml`，推 `main` 自动构建部署。

## 历史

校园版《像素校园 · 青海大学》v0.1 完整保留在 tag `campus-v0.1`，可随时回看。
