---
version: 1
slug: "client-src-ui-panels-strategy-ts"
primary_target: "client/src/ui/panels/strategy.ts"
related_targets: ["client/src/ui/panels/overview.ts", "client/src/ui/panels/tech.ts", "client/src/ui/panels/result.ts", "client/src/ui/panels/reviewView.ts", "client/src/ui/panels/event.ts", "client/src/ui/panels/market.ts", "client/src/ui/styles/decision.css", "client/src/ui/styles/market.css"]
---

# 参考策略与经营复盘

- 访客模式：Operate。中文玩家比较有限资源下的取舍，再手动执行并查看真实结果。
- 信息顺序：本周风险与可执行入口 → 饲草与费用 → 本季使命 → 可见信息和试算边界 → 参考行动及代价 → 周末后果 → 三维成果与逐周轨迹 → 完局策略对照。
- 视觉：沿用灰绿/深绿语义表面、清晰正文与少量像素标题，草金色仅强调主要推进。没有新增白色组件背景。
- 诚实边界：预测复用确定性结算且不看未来随机数；同 seed 对照保留策略改变风险状态的差异。评分为游戏设计参数；不宣称最优算法、真实 IoT、疾病诊断、实证教学效果或参赛资格。
- 操作：参考序列不自动执行；集市整公斤输入支持精确购草和键盘 Enter。草场摘要与动作在前，监测对照可展开；每区每周一次放牧或收割，两者都中断休牧且当周不恢复。事件显示即时效果及资源不足原因，defer只在全部常规方案非法时显示，仍承担BCS −0.2与退化+0.02的有界损失。
- 版本与证据：当前`decision-v2`基准为两场景各30个公开seed，完整局搜索0/30失败、贪心30/30；挑战搜索经营分19.20低于23.25、净资产94138.50低于95964.03，明确呈现生态/经营取舍。只解释当前模型内结果，不证明真人难度、真实收益或教学成效。旧模拟档保留进度，从续玩状态重建起点，旧轨迹不混入v2重放与对照。
- 可达性：原生 details/summary、表格 caption 与标题、可聚焦横滚区域，模态焦点限制与背景 inert。弹窗统一纵滚，窄横屏表格独立横滚。
- 周实验：模拟规则仍为 `decision-v2`，规划器 `beam-profile-v2`，最多16候选、每偏好1552节点；补齐小缺口与维护现金候选。以同一状态对照不行动与均衡/草场/资产偏好。完成后结果置前，主表呈现原始指标与相对基线差，原生 radio 切换行动与分项贡献；逐步即时资源与独立结算明确区分。不跨权重比较总分，不制造不同动作，不把周预测混入真实轨迹。试算旁显示相对真实记录起点的保留余量，公开本周目标不优化季末使命和固定估值的局限。
- 长期参照：概览、集市、策略进入三周储备账，固定当前畜群与设备，只抵扣已知当周放牧，未来不假定经营，逐周显示季节草价、库存缺口、固定费及假设补草现金。并列当前三维阈值、现金与固定保留下限，明确非可执行预测。
- 真实成果：新120局基准仍四组0/30最高成果；搜索两场景均为维持经营，全局留存达标分别24/30、29/30。局末对照分别报告完成、达标和保留比例，不能把0失败率写成成功率。新证据见 `output/review/deep-refinement-acceptance.md` 和 `deep-refinement-code-review.md`。
- 特色解释：概览、桌面和牧场玩法说明可打开高原手记；读取当周草量、休牧、储草、需草和羊单位，共享模型函数，提供经营入口。新表面沿用既有主题，风险文字不依赖颜色独立传达。
- 本轮证据：`output/review/competition-lab-acceptance.md` 与 `competition-lab-code-review.md`；新增导出为 `muyun-week-experiment-v1`，可命令行复算，属于模型内预测证据。正式参赛仍需专家、真人与真机验证，见 `docs/COMPETITION.md`。
- 验收：见 `output/review/decision-acceptance.md` 及 `decision-ui-review.md`；真机触屏、低端设备性能和首次玩家理解度尚未经过实测。
