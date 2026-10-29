# ART_RESEARCH · 像素牧场视觉调研

日期：2026-10-29。网络调研，结论用于本项目的第三轮美术重做。

## 1. 最重要的三条结论

1. **没有"全程序化生成素材"还能好看的农场游戏。** 程序化适合草、树、云、行星这类
   无叙事物体；角色、动物、建筑、UI 仍然需要人工设计的剪影。
   找得到的程序化项目（PixelPlanets、Procedural-Grass、ZzSprite）都只生成背景或图标。
2. **好看的项目都在做四件事**：低噪声大色块地面、统一 3/4 投影、跨格细节簇、
   标准化接触阴影。像素分辨率本身不是决定因素。
3. **"免费"不等于"可商用"。** LimeZu 免费版、Sprout Lands 免费版都明确禁止商用；
   Tiny Swords 当前 Free Pack 也不是 CC0。只有 Kenney 全系是 CC0。

## 2. 开源项目里反复出现的翻车点

| 翻车点 | 症状 | 修法 |
|---|---|---|
| 平铺噪声草地 | 一张 tile 铺满，缩到 25% 能看到方格 | 3–5 个变体 + 跨格草簇 + 低频色块 |
| 树/栅栏按网格排 | 像矩阵、像铁轨 | 随机偏移、成簇、柱子共享、断口 |
| 无接触阴影 | 物体像贴纸浮在地上 | 1–2px 烘焙椭圆影，或独立 shadow 层 |
| 全屏夜晚滤镜 | 世界变暗但 HUD 仍亮 | 环境色 + 局部光，UI 独立层 |
| UI 与像素世界不同语言 | 系统衬线体 + 平滑渐变条 | 像素字体 + 9-slice 面板 + 整数缩放 |
| 混素材包 | 描边宽度、角色比例、色板互相打架 | 只用一个主包，或统一重绘 |
| 场景密度两极化 | 要么空到只有纹理，要么塞满 | 35–45% 低细节地面 + 成簇点缀 |

## 3. 授权核查（重点）

| 素材包 | 许可 | 商用 | 署名 | 结论 |
|---|---|---|---|---|
| Kenney Tiny Farm / Tiny Creatures | CC0 1.0 | 可 | 不需要 | **最安全**，含牛/羊/鸡与农场建筑 |
| LimeZu Modern Farm | 付费 EULA | 可 | 需要 | 精致，但不能分发原始素材 |
| LimeZu Modern Interiors Free | 非商用 | **不可** | 需要 | 只能做 demo |
| Sprout Lands Basic | 非商用 | **不可** | 需要 | 免费下载 ≠ 可商用 |
| Sprout Lands Premium | 付费 | 可 | 需要 | 需按购买页条款 |
| Pixel Frog Tiny Swords | 自定义 | 可 | 不需要 | **禁止再分发**，不是 CC0 |
| OpenGameArt LPC Farm Animals | CC-BY 3.0 / GPL | 可 | 需要 | 有走/吃动画，需署名 |
| OpenGameArt Yak SVG | CC0 | 可 | 不需要 | 矢量手绘，非像素 |

**决策**：本轮不引入外部素材，保持"全部自绘、CC0"的故事；
若后续仍不满意，首选 Kenney Tiny Farm + Tiny Creatures（CC0，零授权风险）。

## 4. 案例拆解（可抄的具体做法）

- **Stardew Valley**：草地大面积平涂 + 2–3 层深绿草簇；泥土路是色块不是砖块，
  草丛以 2–4px 参差伸进路面；栅栏每格 4px 柱 + 2 根 2px 横杆 + 1px 投影。
- **Rusty's Retirement**：没有栅栏，用河道、挡土墙、机器分区；说明边界不一定靠栅栏。
- **Graveyard Keeper**：低饱和橄榄草地 + 强对比石板路；HUD 做成世界里的金属牌。
- **Roots of Pacha**：动物不用纯黑描边，用深棕同色系轮廓 + 椭圆接地影。
- **Fields of Mistria**：一个畜栏 = 栅栏 + 干草 + 食槽 + 2–4 只动物 + 1 个阴影，
  这是可以直接复用的"小构图模板"。
- **Dorfromantik**：成簇 + 留白 + 每屏一个主地标，比"多放物件"更决定高级感。

## 5. 本次落地的 8 条

1. 草地：70% 平涂 / 20% 草簇 / 10% 花；3 个变体；簇跨格、不逐像素随机。
2. 32 色明度梯：4 条 7 阶 ramp（草/土木/石雪/水）+ 4 强调色，步长约 8L。
3. 统一 16px 网格：角色 24×32、动物 32×32、栅栏 16×16、树冠 32×44。
4. 土路 2 格宽，与草地交界处用草簇过渡，不做 1px 全包围黑边。
5. 栅栏：每格 1 根 4px 立柱 + 2 根 2px 横杆 + 每根横杆下 1px 阴影。
6. 接触阴影：动物烘焙椭圆影（地面色降明度），树木带底部阴影。
7. 动画：4 帧行走 + 身体 1px 起伏；不再用 2 帧"滑步"。
8. 道具单独一层：透明像素不再露出背景色；道具成簇分布，保留安静空地。

## 6. 还没做

- **季节性草地贴图**：目前只有色罩和雪粒子，草地本身不随季节变色。
- **autotile 边缘**：道路与草地仍是硬边，没有 16 宫格过渡。
- **建筑立面**：暖棚还是墙/屋顶瓦片拼的，没有独立 sprite。
- **动物行为动画**：只有行走，没有吃草、摆尾、反刍。
- **HUD 像素字体**：仍用系统中文字体，和像素世界有轻微割裂。

## 7. 参考链接

- Slynyrd 像素教程系列（草地/物体/角色/光影/UI）：https://www.slynyrd.com/blog
- Tiled Terrain 手册（16/47 tile）：https://doc.mapeditor.org/en/stable/manual/terrain/
- Boris the Brave, Beyond Basic Autotiling：https://www.boristhebrave.com/2021/09/12/beyond-basic-autotiling/
- Derek Yu, Pixel Art Tutorial：https://www.derekyu.com/makegames/pixelart.html
- Kenney 授权 FAQ（全站 CC0）：https://kenney.nl/support
- Kenney Tiny Farm：https://kenney.nl/assets/tiny-farm
- Sprout Lands 许可原文镜像：https://github.com/Maaack/Sprout-Lands-Tilemap/blob/main/addons/sprout_lands_tilemap/assets/read_me_art.txt
- LimeZu 许可转录：https://github.com/eturner58/game-assets/blob/main/catalog/packs_limezu.json
- Tiny Swords 条款核对：https://github.com/endlessm/threadbare/issues/1781
- 开源参考项目：
  - https://github.com/goncalojbsousa/Farming-Simulator-Cabacos（Phaser 3.90 + Tiled，16px 地形 + 32px 道具，独立 shadow 层）
  - https://github.com/devshareacademy/elemental-farm（Phaser 3 + day/night shader）
  - https://github.com/ZnerB16/FarmLands（Godot 4 + Sprout Lands 调色板）
  - https://github.com/amcolash/farming-game（Phaser 3 + LPC 32px）
