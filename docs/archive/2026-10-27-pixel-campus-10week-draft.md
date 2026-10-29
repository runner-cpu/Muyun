# 像素校园 Web 游戏 · 完整执行方案

> 产品：打开网址即可进入的像素校园世界。首版做室外，宠物对战、躲猫猫作为玩法点；室内与联机按阶段扩展。
> 说明：弹窗调研未收到选择，以下按对话中已确认的信息 + 明确标注的默认假设制定。**标注「假设」的项可在开工前修改，不影响方案结构。**

## 0. 默认假设（可改）

| 项 | 默认值 | 备选 |
|---|---|---|
| 团队 | 单人开发 | 2~3 人按模块拆分 |
| 周期 | 10 周（每周 15~20 小时） | 6 周极简 MVP / 16 周完整版 |
| 用途 | 比赛 + 校园传播 | 纯作品集则砍联机、加技术演示 |
| 编程基础 | 会 JavaScript/TypeScript | 不会 JS 则改用 Godot 4 路线（另出方案） |
| 美术 | 现成素材包 + 自绘地标 | 全自绘 / 外包 |
| 视角 | 星露谷式俯视 3/4 | 吉大式等距 45° |
| 首版范围 | 室外 6~8 个地标 | 缩到 3 个地标验证 |
| 联机 | 单机先行，P3 接房间制 | 首版即联机（工期 +50%） |
| 移动端 | 手机优先 | 桌面优先 |
| 部署 | 免费静态托管 + 低成本 VPS | 校内网演示 |

---

## 1. 项目定义

**一句话**：一个像素风的校园生活小游戏网站——走路逛校园、和场景互动、玩小游戏、收集校园猫，后续支持同学一起联机逛。

**目标用户**：本校同学、校友、招生宣传对象、比赛评委。

**成功标准**：
1. 打开链接 5 秒内进入并可走动（移动端同样成立）。
2. 3 分钟内能让玩家认出校园地标并完成至少一次交互。
3. 比赛：技术分（联机/数据驱动架构）+ 创意分（校园共鸣/小游戏）+ 完成度分（无 Bug、移动端可用）。
4. 传播：可生成分享卡片/截图，链接可直接发微信群。

**范围边界（首版明确不做）**：室内场景、账号系统、匹配系统、全服大世界、战斗数值深度、UGC 编辑器。

## 2. 技术架构

**技术栈**：Phaser 3（最新稳定版）+ TypeScript + Vite + Tiled 1.11+；联机阶段加 Colyseus（Node.js 20）+ Vitest。

**分层**：

```
浏览器
└─ Phaser App
   ├─ Scenes：Boot / Preload / Campus / UI / MiniGames
   ├─ Systems：Input / Interaction / Dialogue / Time / Save / Audio / Network
   ├─ Data：JSON 配置（triggers / dialogues / npcs / pets / minigames）
   └─ NetworkAdapter：LocalAdapter（单机）⇄ ColyseusAdapter（联机）
服务器（P3）
└─ Colyseus CampusRoom（内存状态，房间制）
```

**核心接口（联机预留）**：

```ts
export interface NetworkAdapter {
  connect(roomId: string): Promise<void>;
  send(event: ClientEvent): void;
  on<K extends keyof ServerEvents>(event: K, cb: (payload: ServerEvents[K]) => void): void;
  disconnect(): void;
}
```

业务系统只依赖 `NetworkAdapter`，不直接引用 Colyseus；单机时注入 `LocalAdapter`，联机时切换实现。

**世界状态模型**：

```ts
interface WorldState {
  day: number; timeMinutes: number; weather: 'sunny' | 'rain';
  player: { x: number; y: number; dir: 'up'|'down'|'left'|'right' };
  flags: Record<string, boolean>;          // 收集、剧情、成就
  inventory: Record<string, number>;
  pets: string[];
}
```

原则：状态与表现分离；所有交互产生命令（如 `interact(door_id)`），由系统统一处理并写状态，画面只读状态。

## 3. 工程结构

```
pixel-campus/
├─ client/
│  ├─ index.html  vite.config.ts  package.json  tsconfig.json
│  ├─ public/assets/{tilesets,sprites,ui,audio}
│  └─ src/
│     ├─ main.ts  config/gameConfig.ts
│     ├─ scenes/BootScene.ts  PreloadScene.ts  CampusScene.ts  UIScene.ts
│     ├─ scenes/minigames/MiniGameHost.ts  PetBattleScene.ts  HideSeekScene.ts
│     ├─ entities/Player.ts  NPC.ts  InteractiveObject.ts
│     ├─ systems/InputSystem.ts  InteractionSystem.ts  DialogueSystem.ts
│     │           TimeSystem.ts  SaveSystem.ts  AudioSystem.ts
│     │           NetworkAdapter.ts  LocalAdapter.ts  ColyseusAdapter.ts
│     ├─ ui/DialogueBox.ts  HUD.ts  Toast.ts  Joystick.ts
│     ├─ data/triggers.json  dialogues.json  npcs.json  pets.json  minigames.json
│     └─ types/index.ts
├─ maps/            # Tiled .tmj + .tsx
├─ server/          # P3：src/rooms/CampusRoom.ts, src/schema/PlayerState.ts
├─ tests/           # Vitest 单测
└─ docs/            # 本方案、素材授权记录、验收记录
```

## 4. 地图与美术规范

- 逻辑分辨率 480×270，整数倍放大（3x 为 1440×810），letterbox 填充；`pixelArt: true`、`roundPixels: true`。
- 瓦片 16×16；单区域地图约 100×60 瓦片；区域之间用边缘出口传送。
- Tiled 图层：`ground / ground_detail / buildings / props / shadows / collision / triggers(object)`。
- Trigger 属性：`id, type(dialogue|minigame|portal|collect), payload(JSON), oneShot, requires(flag)`。
- 角色 16×24，四方向各 4 帧；NPC 同规格换色/换装；阴影用椭圆半透明贴图。
- 色板 ≤ 32 色；描边统一 1px 深色（如 `#1a1c2c`）；建筑与地面光照明度拉开层次。
- 素材：一套主 tileset（LimeZu Modern Exteriors / Kenney，记录授权）；自绘地标：校门、主楼、图书馆、食堂、宿舍。

**首版地标优先级**：
1. P0：校门、主楼（验证管线）
2. P1：图书馆、食堂、宿舍、操场
3. P2：湖心花园、商业街（可选）

## 5. 核心系统

### 5.1 玩家控制
- 键盘 WASD/方向键；对角线归一化；步速 90px/s，Shift 跑步 140px/s（可选）。
- 移动端：左下虚拟摇杆（死区 0.2）+ 右下交互按钮；触屏点按交互对象。
- 碰撞：Arcade 物理，脚部碰撞体 12×10；四向朝向取主轴。
- 相机：跟随插值 0.12，按区域设边界，zoom 固定整数 3，roundPixels。

### 5.2 交互系统
- 每个交互物挂 24px 感知区；范围內最近对象高亮显示 E/手指图标。
- 触发后按 type 分发：`DialogueSystem` / `MiniGameHost` / 场景传送 / 收集。
- UI 或小游戏打开时暂停世界输入；交互冷却 300ms。

### 5.3 对话系统
- JSON 对话树，支持说话人、逐字显示（30 字/秒，点击立即完成）、选项分支、flag 条件、结束回调。
- 示例：

```json
{
  "id": "guard_first",
  "speaker": "保安大爷",
  "lines": [
    { "text": "同学，刷卡进校……哦，新来的吧？", "next": 1 },
    { "text": "往里走是主楼，食堂二楼今天有锅包肉。", "end": true }
  ]
}
```

### 5.4 时间与昼夜
- 1 游戏日 = 现实 6 分钟，08:00 开始；宿舍睡觉跳到次日 08:00 并自动存档。
- 光照：按小时插值 8 个色罩（清晨/白天/黄昏/夜晚）；夜晚路灯自发光贴图。
- 场景时段规则：食堂 11:30~13:30、17:30~19:30 营业；图书馆 08:00~22:00。

### 5.5 存档
- localStorage `pixel-campus-save-v1`；睡觉、关键收集、每 60 秒、页面卸载时保存。
- 存档结构含版本号 + 迁移函数，避免后续更新清档。

### 5.6 音频与 UI
- BGM 昼/夜两条循环交叉淡入；音效：脚步、点击、开门、猫叫、胜负。
- 首次用户手势后启动音频（绕开浏览器自动播放限制）。
- HUD：左上日期/时间/天气，右上设置（音量/全屏/画质），左下摇杆，右下交互键；奖励用 Toast。

## 6. 小游戏

**框架契约**：

```ts
export interface MiniGameResult {
  win: boolean; score?: number;
  rewards: { credit?: number; mood?: number; item?: string };
}
// 每个小游戏是独立 Scene：startGame(config) → 结束 emit('minigame:result', result)
```

宿主流程：暂停 CampusScene → 启动小游戏 → 结算 → 恢复世界 → 发奖励 → Toast。

### 6.1 宠物对战（v1 vs NPC）
- 数据：`pets.json`：id、名称、系别（橘/黑/白）、HP、攻击、速度、两个技能（威力/系别）。
- 规则：速度决定先手；伤害 = 技能威力 × 系别倍率（橘克黑、黑克白、白克橘，1.5/0.75）× 随机 0.9~1.1；HP 30~60。
- 流程：选宠 → 选技能 → 结算动画（前冲/闪白/飘伤害数字）→ 对方回合 → 胜负结算。
- 奖励：学分 + 心情；首次胜利解锁新宠物。
- 联机升级：服务器校验回合与随机种子，改为异步/实时 PvP，规则不变。

### 6.2 躲猫猫（v1 vs AI）
- 触发点：操场或宿舍；从 6~8 个预设藏点随机藏一个 NPC。
- 限时 90 秒；靠近提示五档（很冷→就在附近），配提示音频率。
- 找到：心情 + 成就；超时：失败但不惩罚，可重试。
- 联机升级：2~4 人房间，一人躲、其余找，服务器判定距离与胜负。

### 6.3 扩展位（不进首版）
钓鱼、节奏跑、校园知识问答——每个新游戏 = 1 个 Scene + 1 条 JSON 注册。

## 7. 联机设计（P3）

- 房间：`CampusRoom` 单地图一房，maxClients 16；游客身份（localStorage uid），无账号。
- Schema：RoomState（day/time/weather/players/flags）+ PlayerState（x/y/dir/anim/name/color）。
- 同步：服务器 patch 20Hz；客户端输入 10Hz；客户端 100ms 插值缓冲；位置以服务器为准。
- 事件：`interact`（服务器校验距离/冷却后广播）、`emote`、`minigameResult`。
- 断线：10 秒重连宽限，sessionId 存 localStorage。
- 部署：Railway / Fly.io / 1 核 VPS；WSS；客户端 `VITE_SERVER_URL` 配置。
- 成本：静态托管 ¥0；服务器约 ¥0~100/月。

## 8. 性能与兼容

- 首屏 < 5MB（gzip）；代码 < 1MB；纹理合并 1~2 张图集。
- 目标 60fps：中端手机（iPhone 11 / 安卓中端）实测。
- 静态图层合并，避免每帧创建对象；对象池管理飘字/粒子。
- 浏览器矩阵：Chrome/Edge/Safari（iOS 15+）/微信内置浏览器/安卓 Chrome。

## 9. 测试与验收

- 单元测试（Vitest）：伤害公式、系别克制、存档迁移、时间换算。
- 冒烟测试：启动→走动→交互→小游戏→存档→刷新恢复。
- 手动矩阵：桌面 1440×900、手机 390×844、360×640。
- 每阶段验收：
  - P0：5 秒内可走动，无报错。
  - P1：主环线可走通，10+ 交互可触发，移动端可玩。
  - P2：两个小游戏完整结算，奖励入存档。
  - P3：2~4 人互相可见、表情、断线可重连。
  - P4：移动端 60fps、首屏 < 5MB、无阻断性 Bug。

## 10. 里程碑（10 周，单人，每周 15~20 小时）

| 周 | 任务 | 交付/验收 |
|---|---|---|
| W1 | 环境搭建、Phaser 骨架、像素配置、示例地图、移动碰撞、静态部署 | P0 验收 |
| W2 | Tiled 工作流、校门-主楼-图书馆区域、相机、区域传送 | 三区域可走通 |
| W3 | 交互系统、对话框、HUD、虚拟摇杆 | P1 验收 |
| W4 | 食堂/宿舍/操场/湖、NPC 基础、时间昼夜 | 主环线完整 |
| W5 | 小游戏框架 + 宠物对战 | 对战可完整玩一局 |
| W6 | 躲猫猫、奖励/成就、存档、内部试玩 | P2 验收 |
| W7 | Colyseus 服务器、房间加入、玩家同步 | 双人同图可见 |
| W8 | 世界事件同步、表情、断线重连、联机部署 | P3 验收 |
| W9 | 音效、加载页、性能、移动端适配、埋点 | 移动端 60fps |
| W10 | 内容冻结、回归测试、宣传素材、上线 | P4 验收 |

**砍需求顺序（超期时）**：湖 → 操场 → 躲猫猫 → 联机 → 猫图鉴。每周留 20% 机动时间。

## 11. 发布与运营

1. 客户端：`npm run build` → Vercel/Netlify 导入仓库，HTTPS 自动。
2. 服务器：Railway/Fly/VPS 部署 Node 20，健康检查 `/health`。
3. 埋点：Umami/Plausible（免费档）或自建计数；记录访问量、平均停留、小游戏开局数。
4. 宣传：3 张长图（校门/主楼/小游戏）、15 秒 GIF、30 秒竖屏视频。
5. 比赛材料：架构图、技术亮点页、访问数据、用户反馈截图。

## 12. 风险登记

| 风险 | 概率 | 对策 |
|---|---|---|
| 美术产能不足 | 高 | 素材包打底 + 只自绘 5 个地标 |
| 范围膨胀 | 高 | MoSCoW + 第 9 周内容冻结 |
| 联机返工 | 中 | P0 即用 NetworkAdapter + 命令式交互 |
| 移动端体验差 | 中 | P1 起真机测试，虚拟摇杆首版就有 |
| 素材版权 | 低 | 只用 CC0/商用授权，记录来源 |
| 比赛规则限制 | 低 | 校名/校徽仅非商用展示，查赛规 |

## 13. 待确认决策（回复编号即可调整）

1. 团队：单人 / 2~3 人？
2. 周期：6 周 / 10 周 / 16 周？
3. 用途优先级：比赛 / 传播 / 作品集？
4. JS 基础：能直接写 TS / 需要教学式方案？
5. 美术：素材包+自绘 / 全自绘 / 外包？
6. 联机：P3 接 / 首版就要 / 不做？
7. 移动端：手机优先 / 桌面优先？
8. 部署：免费托管 / 已有服务器 / 校内网？

---

## 附：开工清单（W1 Day 1）

- [ ] 安装 Node.js 20 LTS、VS Code、Tiled
- [ ] `npm create vite@latest pixel-campus -- --template vanilla-ts`
- [ ] 安装 `phaser`，配置 480×270 + pixelArt
- [ ] 下载并登记 1 套 CC0 tileset
- [ ] 建 Tiled 示例图（20×12 瓦片），导出 JSON
- [ ] 实现 Boot→Preload→Campus 三场景与玩家移动
- [ ] 部署到 Vercel，手机打开验收
