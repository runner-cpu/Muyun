# ASSETS · 素材与授权

## 项目自制（CC0 1.0）

以下文件由 `tools/` 下的脚本程序化绘制，本项目声明为 CC0 1.0：

| 文件 | 内容 | 生成脚本 |
|---|---|---|
| `client/public/assets/tilesets/ranch-tiles.png` | 512×32，32 个 16px 瓦片。第一行地形：4 种草地、2 种土路、2 种雪地、横/竖栅栏、木桩、干草、墙、屋顶、水面。第二行道具：大小石头、灌木×3、花×2、草簇×3、水槽、木桶、木箱 | `tools/gen-terrain.mjs` |
| `client/public/assets/sprites/yak.png` | 128×128，牦牛 4 方向 × 4 帧，单帧 32×32 | `tools/gen-sprites.mjs` |
| `client/public/assets/sprites/sheep.png` | 128×128，藏羊 4 方向 × 4 帧，单帧 32×32 | `tools/gen-sprites.mjs` |
| `client/public/assets/sprites/player.png` | 96×128，牧人 4 方向 × 4 帧，单帧 24×32 | `tools/gen-sprites.mjs` |
| `client/public/assets/trees/tree_*.png` | 3 种 32×44 树精灵，含阴影 | `tools/gen-trees.mjs` |

生成器共用 `tools/lib/pixel.mjs`（PNG 编码器 + Canvas 原语 + mulberry32）与
`tools/theme.mjs`（统一色板）。

**色板结构**：4 条 7 阶明度梯 + 4 个强调色，共 32 色。

| 色系 | 7 阶 |
|---|---|
| 草 | `#3E4A22` `#4E5C29` `#5F6E32` `#71803B` `#849245` `#98A652` `#AEBB63` |
| 土/木 | `#2E2118` `#43301F` `#5A4128` `#715333` `#8A6840` `#A37F4E` `#BC9760` |
| 石/雪 | `#2B3038` `#3B424C` `#4D5560` `#606A76` `#75808D` `#8B96A3` `#A2ADB9` |
| 水 | `#18313F` `#204457` `#2A5870` `#356D89` `#4283A2` `#5299BA` `#66AFD0` |
| 强调 | 奶油 `#E8D9B0` · 暖橙 `#C4703A` · 砖红 `#B23A2E` · 白 `#F4ECD8` |

明度步长控制在 8L 左右，保证"低噪声"；最深 3 档只用于轮廓和阴影，
最亮 3 档只用于高光和眼睛。

**实现规则**（来自 `docs/ART_RESEARCH.md`）：
- 草地 70% 平涂 / 20% 草簇 / 10% 花，簇跨格，不做逐像素随机。
- 栅栏每格 1 根 4px 立柱 + 2 根 2px 横杆 + 每根横杆下 1px 阴影。
- 动物 32×32，1px 深色轮廓 + 2–3 阶明度 + 烘焙椭圆接地影。
- 道具单独一层渲染，避免透明像素露出背景色。

## 已移除的校园素材

Phase 0 删除了以下内容，完整版本见 tag `campus-v0.1`：

- 22 张校园建筑精灵（`public/assets/buildings/`）
- 160×120 校园地图 `campus.tmj` 与 48 格 tileset
- 5 种校园猫精灵、像素猫 favicon
- `maps/qhu-buildings.geojson`（青海大学公开地图 footprint 快照）

**授权修正**：`qhu-buildings.geojson` 是外部参考数据，此前被误列在
"项目自制（CC0 1.0）"表中；它不应被视为 CC0。该文件已从仓库移除。

## 音频

没有外部音频文件。`src/systems/AudioManager.ts` 用 WebAudio 振荡器合成占位
BGM 与音效，无版权风险。后续替换为 CC0 素材时，必须登记曲名、作者、来源 URL、许可证。

## 字体

使用系统中文字体栈（Microsoft YaHei / PingFang SC / Noto Sans SC），未打包字体文件。

## 待补清单

- [ ] 暖棚、谷仓、棚圈、土房的立面精灵（当前用墙/屋顶瓦片拼）
- [ ] 牦牛、藏羊的 3–4 帧行走动画（当前 2 帧 idle）
- [ ] 季节草地变体（秋季枯黄、冬季覆雪）
- [ ] CC0 风雪环境音与牛铃音效
- [ ] 宣传截图、GIF、3 分钟演示视频
