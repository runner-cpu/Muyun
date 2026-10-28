# ASSETS · 素材与授权

## 项目自制（CC0 1.0）

以下文件由 `tools/gen-assets.mjs` 程序化绘制，本项目声明为 CC0 1.0，可自由替换：

| 文件 | 内容 |
|---|---|
| `client/public/assets/tilesets/campus-tiles.png` | 32 个 16×16 瓦片：草地、道路、广场、水面、墙体、窗户、门、屋顶、树、跑道、球场、长椅、路灯、喷泉、围栏等 |
| `client/public/assets/sprites/player.png` | 16×24 四方向 × 4 帧角色 |
| `client/public/assets/sprites/cats.png` | 16×16 五种猫 × 2 帧 |
| `client/public/assets/buildings/*.png` | 22 栋 2.5D 建筑精灵：图书馆、体育中心、活动中心、食堂、4 栋公寓、各学院楼、门卫室；核心楼由公开 footprint 轮廓挤出 |
| `maps/qhu-buildings.geojson` | 青海大学公开地图的 128 个建筑 footprint 快照（只作为轮廓/层数/高度参考，不随游戏发布） |
| `client/public/assets/trees/tree_*.png` | 3 种 32×44 树精灵，含阴影 |
| `client/public/favicon.svg` | 像素猫 favicon |

## 地图

`tools/gen-map.mjs` 生成 `maps/campus.tmj` 与 `client/public/assets/maps/campus.tmj`：

- 160×120 格，16×16 瓦片。
- 基于青海大学公开地图的点位相对位置（见 `docs/QHU_MAP_REFERENCE.md`）。
- 建筑轮廓/层数/高度参考公开的 `threeDimensionSource/2` footprint 数据（保存为 `maps/qhu-buildings.geojson`），归一化后用于 `footprints.json`。
- **未使用**学校 3D 模型、贴图或倾斜摄影数据；仅参考公开地图的建筑 footprint、名称、相对坐标与道路拓扑。
- 地图源文件可用 Tiled 1.11+ 打开继续编辑。

## 音频

当前没有外部音频文件。`src/systems/AudioManager.ts` 使用 WebAudio 振荡器合成占位 BGM 和音效：

- 无版权风险，但音色简单。
- 后续替换为 CC0 素材时，必须在本文件登记曲名、作者、来源 URL、许可证。

## 字体

使用系统中文字体栈（Microsoft YaHei / PingFang SC / Noto Sans SC），未打包字体文件。

## 待替换清单

- [ ] 5 个地标建筑立面（北门、睿智楼、图书馆、学生食堂、学生公寓）
- [ ] 正式 tileset（Kenney / LimeZu / 自绘）
- [ ] 正式角色与 NPC 立绘
- [ ] CC0 BGM 昼夜两条 + 音效
- [ ] 宣传图、GIF、项目页截图
