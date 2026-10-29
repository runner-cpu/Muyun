# ASSETS · 素材与授权

## 项目自制（CC0 1.0）

以下文件由 `tools/` 下的脚本程序化绘制，本项目声明为 CC0 1.0：

| 文件 | 内容 | 生成脚本 |
|---|---|---|
| `client/public/assets/sprites/player.png` | 16×24 四方向 × 4 帧角色 | `tools/gen-assets.mjs` |
| `client/public/assets/trees/tree_*.png` | 3 种 32×44 树精灵，含阴影 | `tools/gen-trees.mjs` |

> Phase 0 的牧场地面、畜栏、暖棚由 `RanchScene` 运行时用 `Graphics` 绘制，
> 不产生文件。Phase 3 会改为 `tools/gen-assets.mjs` 生成 `ranch-tiles.png`。

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

- [ ] `ranch-tiles.png`：草地 4 变体、裸土、雪地、木栅栏 16 件、水槽、干草堆
- [ ] 牦牛、藏羊精灵（16×16，4 方向 × 2 帧）
- [ ] 暖棚、谷仓、棚圈、土房立面
- [ ] CC0 风雪环境音与牛铃音效
- [ ] 宣传截图、GIF、3 分钟演示视频
