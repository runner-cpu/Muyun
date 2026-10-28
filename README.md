# 像素校园 · 青海大学

打开网页就能游玩的像素校园世界。当前为 **v0.1 可玩垂直切片**：北门、睿智楼、图书馆、学生食堂、学生公寓、西田径场、东田径场、公园和南门/东门/西门都已接入，支持移动、交互、对话、时间昼夜、存档、猫图鉴、宠物对战和躲猫猫。

> 非官方学生作品。校园布局参考青海大学公开地图的相对位置，像素素材为项目自制占位素材。

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
- 白天/夜晚会自动切换；回学生公寓睡觉推进到第二天 08:00。

## 已实现

- Phaser 3 + TypeScript + Vite；逻辑分辨率 480×270，16×16 瓦片，整数缩放。
- 160×120 的全校区 Tiled 地图（`client/public/assets/maps/campus.tmj`），含 ground / detail / shadows / buildings / props / collision / triggers 七层。
- 22 栋 2.5D 建筑精灵（图书馆、综合体育中心、学生活动中心、学生食堂、4 栋学生公寓、各学院楼、门卫室）+ 3 种树精灵；核心建筑使用学校公开 footprint 轮廓做挤出，不再使用方块楼贴图。
- 28 个地图触发器：签到、公告、5 个院系上课点、课程表、知识问答、座位提示、打饭、睡觉、5 只猫、宠物对战、躲猫猫、看台、售货机、路灯开关、4 个 NPC 对话。
- 5 个剧情 NPC：保安大爷、食堂阿姨、图书管理员、猫协同学、神秘训练师。
- 时间系统：1 游戏日 = 现实 6 分钟；清晨/白天/黄昏/夜晚色罩；食堂与图书馆营业时间。
- localStorage 存档（schema v3），睡觉/收集猫/60 秒/页面隐藏时保存；旧 v0/v1/v2 存档自动迁移并重置到全校区地图出生点。
- 宠物对战：三系克制（橘→黑→白→橘）、速度先手、技能、伤害浮动、胜负奖励。
- 躲猫猫：8 个藏点、90 秒、冷热提示、每日 3 次。
- 猫图鉴与成就：首只猫、对战首胜、躲猫猫首胜、7 天签到等。
- 现代浏览器 + 中端手机：FIT 缩放、摇杆、触摸按钮、竖屏旋转提示。
- 程序化 WebAudio 占位 BGM/音效，无外部音频版权负担。

## 项目结构

```
client/                 前端
  src/scenes/           Boot / Preload / Title / Campus
  src/systems/          Input / Interaction / Dialogue / Time / Save / Audio / NetworkAdapter
  src/entities/         Player / NPC / Cat
  src/minigames/        battle / PetBattleUI / HideSeekGame
  src/world/            Tiled 地图加载
  src/ui/               HTML/CSS 叠加 UI、对话、摇杆、设置
  src/data/             dialogues / pets / skills / cats / hidespots / content
  public/assets/        tileset、角色、猫、2.5D 建筑、树、Tiled 地图
maps/campus.tmj         Tiled 源文件副本
tools/                  素材与地图生成脚本
docs/                   方案、地图参考、决策记录
```

## 测试

```bash
cd client
npm test
npm run build
```

当前 13 个单元测试覆盖：三系克制、伤害、回合顺序、胜负判定、时间格式/时段/营业时间、存档迁移与边界值。

## 部署

`vite.config.ts` 使用 `base: './'`，可部署到 Vercel、Netlify 或 GitHub Pages：

- Vercel：Root Directory 选 `client`，Build Command `npm run build`，Output `dist`。
- GitHub Pages：把 `client/dist` 推到 Pages 分支，或使用 GitHub Actions。
- 部署前可把 `index.html` 的标题与说明改成最终名称。

## 待补资料

见 `PROJECT.md` 的「需要你提供」一节。
