# 牧云学习附加层交付说明

本轮依据用户提供的《牧云项目修改指令》，在 `94fa00a` 基础上完成教学周、压力流向、偏好视觉、结算归因和横屏交付检查。定位仍是高原草畜平衡的决策训练与策略实验；本轮改善玩家理解与复盘，不调整模拟规则，也没有把浏览器测试当作教学效果证据。

## 实现与验收口径

| 任务 | 已实现行为 | 主要文件 | 新增测试 |
| --- | --- | --- | --- |
| A 教学周 | 独立内存练习，8 头牦牛、2 行动、P1 放牧与购草；未补足也能结算；手动重试/进入完整经营；一次非阻断邀请 | `core/TutorialWeek.ts`、`ui/tutorial.ts`、`ui/tutorialEntry.ts`、`ui/tutorialPreferences.ts`、标题/牧场接入 | 教学核心 11、UI 4、入口 6 |
| B 三周压力 | 概览自动挂载，库存缺口与固定费分开计量；有效状态通知更新；点周行进入原表格；离开取消订阅 | `ui/pressureFlow.ts`、`ui/panels/overview.ts`、`pressure-flow.css` | 数据与边界 12、生命周期 4 |
| D 实际归因 | 真实起点与选择重放、数据核验后，只选最高优先一句；结算与历史同函数；旧档明确回退 | `ui/attribution.ts`、`systems/WeekFlow.ts`、`ui/panels/reviewView.ts` | 纯派生 20、接入 4 |
| C 偏好视觉 | 原名、原权重，青绿/深绿/暖金 SVG 标识，短描述与权重条；四项结果摘要共用固定刻度与基线 | `ui/strategyVisuals.ts`、`ui/panels/strategyView.ts`、`strategy-personas.css` | 可访问性 2、归一化 5 |
| E 横屏交付 | 局中逐周复盘入口；安全区、动态视口与滚动链；操作反馈进入面板正常流，保留错误并清理跨面板成功提示；三档自动化与性能记录 | `ui/panels/history.ts`、`UIManager.ts`、界面样式、`tools/learning-layer-check.mjs` | 局中复盘 1；浏览器检查另列 |

表中源码路径均以 `client/src/` 为根；测试在 `client/tests/`。69 项新增测试加上原有 330 项，最终为 **54 个测试文件、399 项，全通过**。原有测试文件未删改。

共享工作树中 B/C/D 并行实现，A 接入后先通过 51 文件/384 项与生产构建；补充教学 UI、入口和局中历史验证后通过 395 项；最终独立审查补上归因的完整状态校验入口，全量 54 文件/399 项与 `npm run build` 通过。完整原始记录在 [`test-results.txt`](../output/review/2026-11-12-learning/test-results.txt) 与 [`build-results.txt`](../output/review/2026-11-12-learning/build-results.txt)。构建仍有既存的 onboarding 静态/动态导入提示，该模块未被分包；不是构建失败或运行时报错。

## 相对建议方案的必要适配

1. 教学不增加持久化 `ScenarioId`，也不注入完整经营开局。四区结构保持合法，P2–P4 初始草量为零并由受限控制器拒绝操作。结算只调用原有 `settleDeterministic`，明确只练习确定性饲喂环节，不运行事件、天气或日历，也不创建正式周轨迹。
2. 教学配置是原模型可接受的 8 头 300 kg 牦牛、P1 总草量 500 kg、500 元现金、无雇工或设备。真实供需为需草 462 kg → 放牧提供 300 kg → 缺 162 kg → 按缺口补足。另可选择固定 200 kg；一次固定购草花 352 元，余款不能支付第二笔当前可用购草。两种顺序均使用原动作合法性校验，不能执行额外动作。3–5 分钟是设计目标，未进行真人计时研究。
3. `reserveBudget` 的原口径包含本周，图使用实际第 N、N+1、N+2 周，而不是把原公式向后平移。公斤与元分两条刻度；不存在把固定费画成干草数量的混合单位。正余量为充足，零余量为偏紧，真实库存缺口或固定费现金不足为缺口，没有增加百分比阈值。
4. 资产偏好描述为“更重视本周净资产”，避免暗示一定保留现金或存栏。摘要刻度为饲草覆盖 0–100%、退化 0–100%（下降较好）、BCS 1–5、资产 0–当前输入净资产 2 倍；超刻度显示封顶与原值，无存栏或起点资产非正时显示明确空状态。三方案同刻度，不把微小差别拉成满格。
5. 确认结算前的状态已经包含购草、出售等即时结果，不能直接用这两个快照虚构动作因果。归因从真实记录起点与动作/事件重建整周，区分动作数量和全周合计变化；直接输入与实际历史入口都核验草区、个体等物理字段，历史核验还执行当前周已记录选择后再对照当前状态，避免聚合相同却指错对象。历史缺少完整起点、选择或核对不符时显示回退。每次只用优先级最高一句，避免横屏引言过长；不把整周变化全部归因于某一次购草或治疗。

## 未改变的行为

- `client/src/sim/`、正式初始状态、基准实验脚本和模拟数值均无改动；不是通过调参改善结果。
- `decision-v2`、`beam-profile-v2`、`decision-assessment-v1`、schema v2、`muyun-run-v1` 与 `muyun-week-experiment-v1` 保持不变。
- 完整经营/越冬挑战入口和存档键、越冬预装设备及其成本不变。教学只写独立 `muyun-tutorial-ui-v1` UI 偏好，损坏或无存储权限时回退；既有正式存档需原确认流程才会替换。
- 压力、人格摘要与归因均为展示层派生，不写入真实轨迹或实验单；既有重放、实验复算、存档隔离与 Worker 取消/超时测试继续通过。
- 不改 `docs/SIMULATION.md`、`docs/DEMO.md` 规则说明，不增加后端或 polyfill 依赖；保留既有像素美术与两种正式模式。

## 浏览器与视觉证据

自动化使用 Chromium 156.0.8078.4 的独立上下文，1280×720 鼠标、844×390 与 667×375 开启 `hasTouch` / `isMobile`，通过实际点击执行动作。17 组学习层检查通过，覆盖教学未补足与补足两路、重试、正式存档字节隔离、直接入局的邀请与覆盖确认取消/重开、压力图往返、真实放牧与结算、历史句一致、三偏好和后台 Worker、面板背景交互限制、长面板实际触摸滑动及标题/关闭位置。旧生产 smoke 另通过 5 项检查，覆盖固定越冬模式、Worker、缓存和集市输入往返。证据为 `preview-results.json` 与 `preview-legacy-results.json`；应用警告、页面异常和 HTTP 错误均为零。

桌面和横屏截图见 [`output/review/2026-11-12-learning/`](../output/review/2026-11-12-learning/)，其中四项必需证据为：

| 功能 | 1280×720 | 844×390 |
| --- | --- | --- |
| 教学 | [练习](../output/review/2026-11-12-learning/preview-tutorial-1280.png) | [练习](../output/review/2026-11-12-learning/preview-tutorial-844.png) |
| 压力流向 | [概览](../output/review/2026-11-12-learning/preview-pressure-1280.png) | [概览](../output/review/2026-11-12-learning/preview-pressure-844.png) |
| 偏好卡片 | [偏好](../output/review/2026-11-12-learning/preview-personas-1280.png) | [偏好](../output/review/2026-11-12-learning/preview-personas-844.png) |
| 结算归因 | [回顾](../output/review/2026-11-12-learning/preview-attribution-1280.png) | [回顾](../output/review/2026-11-12-learning/preview-attribution-844.png) |

脚本可对生产预览或 Pages 运行：

```powershell
$env:PLAYWRIGHT_MODULE = '<已安装的 Playwright index.mjs 绝对路径>'
node tools/learning-layer-check.mjs http://127.0.0.1:5189/ preview all
node tools/learning-layer-check.mjs https://runner-cpu.github.io/Muyun/ pages ui
```

`all` 包含五次独立冷启动与界面检查；`ui` 只检查流程；`performance` 只记录加载。`tools/production-smoke-check.mjs` 保留原用法。脚本不接触用户实际浏览器的存档。

## 首屏加载记录与限制

同机 Chromium、禁用 HTTP 缓存、无 CPU/网络限速，各 5 次独立上下文。基线通过 `git archive 94fa00a` 在隔离临时目录构建；最终预览使用本轮构建。原始样本与方法分别为 [baseline-performance.json](../output/review/2026-11-12-learning/baseline-performance.json) 和 [preview-performance.json](../output/review/2026-11-12-learning/preview-performance.json)。

| 中位数 | 基线 | 本轮 |
| --- | ---: | ---: |
| 观察到标题可见 | 508.0 ms | 509.4 ms |
| DOMContentLoaded | 137.9 ms | 138.7 ms |
| load | 158.2 ms | 162.3 ms |
| JS 传输 | 397,631 B | 404,997 B |
| JS 解码 | 1,389,809 B | 1,410,068 B |
| 用户发起试算前 Worker | 0 | 0 |

**最终构建的这批样本略慢于基线**，标题观察增加 1.4 ms，load 增加 4.1 ms；首屏 JS 解码增加 20,259 B（约 1.46%），传输增加 7,366 B（约 1.85%）。前一个构建采样曾测到标题中位 579.3 ms；最终修复后重新采样仍不能宣称提速。五次本地样本包含测试器观察延迟与主机波动，不能证明代码独立造成全部耗时变化。Phaser 仍占主要体积，本轮没有完成主引擎减包。教学视图延迟到明确点击后加载（独立约 6.10 kB / gzip 2.75 kB），计算 Worker 仍只在请求计算时启动，取消与 60 秒超时语义未改。没有新增运行时依赖。

**未覆盖真机**：iOS Safari、Android Chrome 真机、真实刘海/浏览器地址栏伸缩、虚拟键盘、屏幕阅读器和低端硬件性能均未核验。CSS 使用动态视口、安全区与滚动链隔离是实现措施，不代表通过了这些设备验收。完整待测表见 [mobile-device-checklist.md](mobile-device-checklist.md)。像素字体已预载且保留 `font-display: swap`，正文使用本机中文字体；没有新增远端字体请求。

## 发布记录

本地最终验证完成后推送至 `runner-cpu/Muyun` 的 `main`，由现有 Pages 工作流执行测试、构建、部署。工作流结果与线上“冷启动 → 教学周 → 完整经营”证据在发布后补入本节。
