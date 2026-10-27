# 像素校园 Web 游戏 · 架构与实施计划

> 产品形态：打开网址即可进入的像素校园世界（首版仅室外），支持漫游、场景交互、小游戏（宠物对战、躲猫猫）；架构预留 2~4 人房间联机。
> 默认假设：单人开发、8~10 周出可玩在线版；如不做联机，5~6 周可出单机版。

---

## 1. 技术选型（决定性决策）

**Phaser 3 + TypeScript + Vite + Tiled + Colyseus（联机阶段）**

选择理由：
- 纯 Web 原生，首屏加载 < 5MB，真正"进网站即玩"；Godot 4 的 Web 导出包体 20~40MB、启动数秒，明显更重。
- Phaser 的 Tilemap、Arcade 物理、像素渲染（`pixelArt: true` + `roundPixels: true`）正是为这类游戏设计。
- 小游戏 = 独立 Phaser Scene，叠加在世界上运行，扩展成本低。
- Colyseus 是 Node.js 权威房间服务器框架，与 Phaser 是成熟组合，后期接联机不需要重写业务代码。

备选：Godot 4（可视化编辑器友好，适合不写代码的人，但 Web 包体重）；Three.js 不适用（3D 无必要）。

**架构铁律（为联机预留）：**
1. 状态与表现分离：世界状态是唯一真相，画面只是投影。
2. 所有交互走命令/事件（`interact(door_id)`），不直接改状态。
3. `NetworkAdapter` 接口：`LocalAdapter`（单机）与 `ColyseusAdapter`（联机）可切换，业务代码无感。

## 2. 目录结构

```
client/src/
  scenes/BootScene.ts            # 启动与加载
  scenes/CampusScene.ts          # 主地图世界
  scenes/UIScene.ts              # HUD / 对话 / 小游戏入口
  scenes/minigames/PetBattleScene.ts
  scenes/minigames/HideSeekScene.ts
  systems/InteractionSystem.ts
  systems/DialogueSystem.ts
  systems/TimeSystem.ts
  systems/SaveSystem.ts
  systems/NetworkAdapter.ts
  data/triggers.json  dialogues.json  pets.json  hidespots.json
public/assets/{tilesets,sprites,audio}
server/                          # P3 阶段
  rooms/CampusRoom.ts            # Colyseus 房间与 schema
```

## 3. 地图与美术规范

- 16×16 瓦片；逻辑分辨率 480×270，整数倍放大 3~4 倍；像素渲染开启整数缩放与 roundPixels。
- Tiled 分层：`ground / buildings / decor / collision`，另加 `triggers` object layer（带 properties，如 id、类型、参数）。
- 一套主 tileset 打底（LimeZu Modern Exteriors / Kenney），只自绘 3~5 个地标（校门、主楼、图书馆、食堂、宿舍），其余用素材。
- 角色 16×24，四方向各 4 帧；NPC 同规格。
- 首版室外范围：校门 → 主楼 → 图书馆 → 食堂 → 宿舍 → 操场，一条主环线，步行 2~3 分钟一圈。

## 4. 交互系统

- TriggerZone 进入显示提示（E 键 / 点击 / 移动端点按），触发三类行为：对话框、小游戏、场景事件（开门、传送、收集）。
- 全部 JSON 数据驱动：新增交互只改 JSON，不改代码。
- 对话支持打字机效果与选项分支；互动目标在移动端可直接点选。

## 5. 小游戏框架

统一契约：小游戏是独立 Scene，入口 `startGame(config)`，结束 emit `result`（胜负、奖励），主场景负责发奖与存档。

**宠物对战（v1 vs NPC）：**
- 校园猫收集即宠物（与猫图鉴打通）；属性：HP / 攻击 / 速度；每只 2 个技能；橘/黑/白三系克制。
- 回合制：选技能 → 结算 → 状态更新；MVP 纯客户端逻辑，联机阶段改为服务器校验回合。

**躲猫猫（v1 vs AI）：**
- 触发后从 5~8 个预设藏点随机藏 NPC；玩家 90 秒内找到；接近时"冷热"提示。
- 联机阶段升级为真人躲藏，服务器判定胜负。

新增小游戏 = 新建一个 Scene + 在 JSON 注册，不影响主世界。

## 6. 联机预留设计（P3 实施）

- 同步模型：玩家位置/朝向/动画以 10~15Hz 广播 + 客户端插值；世界事件（收集、小游戏结果、门状态）走事件广播；服务器权威裁决。
- 房间制：一张地图一个 CampusRoom，容量 8~20 人；游客身份（localStorage 生成 uid），不做账号系统。
- 消息类别：`join / snapshot / input / event / emote`；服务器固定 tick。
- 部署：静态站（Vercel / Netlify）+ Colyseus 服务器（Railway / Fly / 1 核 VPS），WSS；月成本约 ¥0~100。
- 比赛演示档：局域网或单房间直连即可，不做匹配、不做持久化排行榜。

## 7. 里程碑（每阶段有验收标准）

| 阶段 | 周期 | 交付物 | 验收标准 |
|------|------|--------|----------|
| P0 骨架 | 第 1 周 | 网站壳 + Phaser + 一张小地图 + 走动碰撞 | 打开网址 5 秒内可走动 |
| P1 室外地图 | 第 2~3 周 | 校园主环线、交互系统、对话、移动端虚拟摇杆 | 逛完一圈并触发 10+ 交互 |
| P2 小游戏 | 第 4~5 周 | 小游戏框架 + 宠物对战 + 躲猫猫 | 两个小游戏可完整玩一局并结算奖励 |
| P3 联机 | 第 6~8 周 | Colyseus 房间、玩家互相可见、表情 | 2~4 人同图可见、可互动 |
| P4 打磨 | 第 9~10 周 | 音效、加载页、访问埋点、宣传素材 | 移动端流畅、可对外发布 |
| 后续 | — | 室内场景逐栋加入（每栋 = 一张 Tiled 图 + 场景切换） | — |

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| 小游戏范围膨胀 | 首版严格限定 2 个；每个小游戏都相当于一个独立小项目 |
| 美术风格漂移 | 只用一个主素材包，地标自绘也遵守同一色板与描边规范 |
| 联机后期返工 | P0 起就用 NetworkAdapter 抽象，交互走命令模式 |
| 移动端体验 | 传播主战场是手机：虚拟摇杆 + 点按交互 + 整数缩放必须首版就有 |
| 地图过大 | 首版只做一条 2~3 分钟环线，按区域切图，后续扩 |

---

## 后续可扩展（不进入首版）

- 室内场景：图书馆、食堂、教室、宿舍，逐栋加入。
- 更多小游戏：钓鱼、节奏跑、问答。
- 社交：表情、合影、留言墙。
- 真实数据接入（图书馆座位等）。
