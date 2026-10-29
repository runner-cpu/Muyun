# ASSETS · 素材与授权

## 项目自制（CC0 1.0）

以下文件由 `tools/` 下的脚本程序化绘制，本项目声明为 CC0 1.0：

| 文件 | 内容 | 生成脚本 |
|---|---|---|
| `client/public/assets/tilesets/ranch-tiles.png` | 256×16，16 个 16px 瓦片：4 种草地、2 种土路、2 种雪地、横/竖栅栏、木桩、花、干草、墙、屋顶、水面 | `tools/gen-ranch-assets.mjs` |
| `client/public/assets/sprites/yak.png` | 32×64，牦牛 4 方向 × 2 帧，单帧 16×16 | `tools/gen-ranch-assets.mjs` |
| `client/public/assets/sprites/sheep.png` | 32×64，藏羊 4 方向 × 2 帧，单帧 16×16 | `tools/gen-ranch-assets.mjs` |
| `client/public/assets/sprites/player.png` | 16×24 四方向 × 4 帧角色 | `tools/gen-assets.mjs` |
| `client/public/assets/trees/tree_*.png` | 3 种 32×44 树精灵，含阴影 | `tools/gen-trees.mjs` |

生成器共用 `tools/lib/pixel.mjs`：自研 PNG 编码器（zlib deflate + CRC32）、
Canvas 原语（px / rect / circle / ellipse）、mulberry32 确定性随机。
所有输出可重复生成，无第三方依赖。

**32 色板**（`tools/gen-ranch-assets.mjs` 内的 `P` 常量）：

- 天空 / 水面 `#1B3A5C` `#3A5C7A` `#5A7C9A`
- 草地 `#77743A` `#676432` `#8C8744` `#9B9550`
- 土路 `#6B5A3A` `#7A6844`
- 雪 `#DCE8EE` `#C4D6E0`
- 木料 `#5B4526` `#8A6A3A` `#3D2F1D`
- 牦牛 `#1A1612` `#322A22`
- 暖色 `#C4703A` `#B99B52`

> Phase 0 的牧场地面、畜栏、暖棚曾由 `RanchScene` 运行时用 `Graphics` 绘制；
> Phase 3 起改为脚本生成的瓦片地图，运行时只负责组装。

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
