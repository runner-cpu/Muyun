# ASSETS · 素材与授权

## 项目自制（CC0 1.0）

以下文件由 `tools/` 下的脚本程序化绘制，本项目声明为 CC0 1.0：

| 文件 | 内容 | 生成脚本 |
|---|---|---|
| `client/public/assets/tilesets/ranch-tiles-{spring,summer,autumn,winter}.png` | 512×32，四季各一套，32 个 16px 瓦片。第一行地形：4 种草地、2 种土路、2 种雪地、横/竖栅栏、木桩、干草、墙、屋顶、水面。第二行道具：大小石头、灌木×3、花×2、草簇×3、水槽、木桶、木箱 | `tools/gen-terrain.mjs` |
| `client/public/assets/sprites/yak.png` | 128×128，牦牛 4 方向 × 4 帧，单帧 32×32 | `tools/gen-sprites.mjs` |
| `client/public/assets/sprites/sheep.png` | 128×128，藏羊 4 方向 × 4 帧，单帧 32×32 | `tools/gen-sprites.mjs` |
| `client/public/assets/sprites/player.png` | 96×128，牧人 4 方向 × 4 帧，单帧 24×32 | `tools/gen-sprites.mjs` |
| `client/public/assets/trees/tree_*.png` | 3 种 32×44 树精灵，含阴影 | `tools/gen-trees.mjs` |
| `client/public/assets/structures/barn.png` | 48×56 谷仓，3/4 视角，屋顶 55%，含门/窗/阁楼/接地阴影 | `tools/gen-structures.mjs` |
| `client/public/assets/structures/{well,woodpile,cart,laundry}.png` | 24×24 水井、24×16 柴堆、32×24 推车、24×24 晾衣绳 | `tools/gen-structures.mjs` |
| `client/public/assets/structures/sign.png` | 16×16 木牌 | `tools/gen-structures.mjs` |

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
- 原程序化动物单帧 32×32，1px 深色轮廓 + 2-3 阶明度 + 烘焙椭圆接地影。当前运行时使用下方单独登记的细化图集，世界显示尺寸仍为 32×32。
- 道具单独一层渲染，避免透明像素露出背景色。

## AI 生成的标题画面

| 项目 | 记录 |
|---|---|
| 用途 | 标题页高原牧场主视觉 |
| 生成日期 | 2026-10-30 |
| 生成入口 | 全局命令 `C:\Users\runner\.codex\tools\codex-image.cmd` |
| 本次模型 | `gpt-image-2.5` |
| 生成源文件 | `output/imagegen/muyun-plateau.png` |
| 运行时资源 | `client/public/assets/art/plateau-title.webp` |
| 授权说明 | 项目通过图像生成服务生成的素材，使用范围依生成服务条款及适用法律确定；不列入本文件的 CC0 自制素材授权 |

运行时使用压缩 WebP，生成源图独立保留，便于追溯与重新导出。生成过程遵循模型检查与图像生成接口规则，不在项目文件中保存 API 密钥。

## AI 生成的细化人物与牲畜

2026-10-30 通过全局命令 `C:\Users\runner\.codex\tools\codex-image.cmd`、模型 `gpt-image-2.5` 生成三套四方向图集。每套 4 行 × 4 列，行顺序为下、左、右、上，每方向四帧。人物增加帽檐、围巾、腰带和衣褶；牦牛增加肩峰、长毛、弯角与蹄；藏羊增加卷毛、黑脸和角。

| 生成源文件 | 运行时资源 | 图集与显示尺寸 |
|---|---|---|
| `output/imagegen/herder-sheet-source.png` | `client/public/assets/sprites/herder-detailed.png` | 192×256，单帧 48×64，显示 24×32 世界单位 |
| `output/imagegen/yak-sheet-source.png` | `client/public/assets/sprites/yak-detailed.png` | 256×256，单帧 64×64，显示 32×32 世界单位 |
| `output/imagegen/sheep-sheet-source.png` | `client/public/assets/sprites/sheep-detailed.png` | 256×256，单帧 64×64，显示 32×32 世界单位 |

`tools/normalize-ranch-sprites.py` 负责去除品红底、清理边缘、按整套共享比例进行最近邻缩放，并统一脚底锚点；处理记录保存在 `output/imagegen/ranch-sprites-normalization.json`，静态与动画预览保存在 `output/review/*-sprite-preview.{png,gif}`。新资源使用独立文件名，不会被旧 `gen-sprites.mjs` 覆盖；HUD 畜群缩略图使用同一新版牦牛素材。

以上图像由生成服务生成，使用范围依生成服务条款及适用法律确定，**不列入 CC0 程序化自制素材授权**。生成遵循模型检查与 images/generations 接口规则；图像与处理记录不包含 API 密钥。

## 已移除的校园素材

Phase 0 删除了以下内容，完整版本见 tag `campus-v0.1`：

- 22 张校园建筑精灵（`public/assets/buildings/`）
- 160×120 校园地图 `campus.tmj` 与 48 格 tileset
- 5 种校园猫精灵、像素猫 favicon
- `maps/qhu-buildings.geojson`（青海大学公开地图 footprint 快照）

**授权修正**：`qhu-buildings.geojson` 是外部参考数据，此前被误列在
"项目自制（CC0 1.0）"表中；它不应被视为 CC0。该文件已从仓库移除。

## 音频

没有外部音频文件。`client/src/systems/AudioManager.ts` 用 WebAudio 振荡器合成
BGM 与音效，没有引入第三方录音。后续替换或新增音频时，应登记曲名、作者、来源和许可证。

## 字体

| 项目 | 记录 |
|---|---|
| 字体 | Fusion Pixel Font，简体中文 12px 比例字形 |
| 原作者 | TakWolf |
| 本地文件 | `client/public/assets/fonts/fusion-pixel-12px.woff2` |
| 来源 | [fusion-pixel-12px-proportional-zh_hans.otf.woff2](https://fusion-pixel-font.takwolf.com/fusion-pixel-12px-proportional-zh_hans.otf.woff2) |
| 许可证 | SIL Open Font License 1.1（OFL 1.1） |
| 本地许可证 | `client/public/assets/fonts/OFL.txt`，保留上游版权和完整授权文本 |

该字体自托管，不依赖运行时请求外部字体服务。系统中文字体栈作为回退。字体授权独立于项目自制图像，不属于 CC0 素材。

## 待补清单

- [x] 独立谷仓立面，以及水井、柴堆、推车和晾衣绳道具
- [x] 牦牛、藏羊四方向四帧精灵与场内游走
- [x] 春夏秋冬草地瓦片与树木季节变化
- [x] 标题页高原画面与自托管字体，登记来源和授权
- [ ] CC0 风雪环境音与牛铃音效
- [ ] 宣传截图、GIF、3 分钟演示视频
