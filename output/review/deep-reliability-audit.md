# 可靠性、恢复与经营记录可信度深度审查

日期：2026-10-30。范围：存档加载/清除、退出自动保存、事件和周结算恢复、经营记录重放、异步面板，以及键盘/移动输入生命周期。初次只读排查后，按主代理授权仅实施两个已确认问题；未修改 UIManager、WeekFlow 或 ranchView，未重复处理上一轮 Animal canvas 修复。

结论：**已修复 2 个可复现 P2；本次定向验证通过。** 下面的数值来自真实生产模块的本地复现，浏览器交互与最终全套构建由主代理汇总验收。

## P2 · 清除挑战存档可能覆盖完整经营槽（已修复）

触发条件：已有完整经营存档，在越冬挑战中打开设置，确认“清除存档”。原 `settings.ts` 先清 active 挑战槽，再调用无 scenario 的 `gameState.newGame()`，将内存改成完整经营新局，随后 reload。此时 RanchScene 尚 active，`main.ts` 的 beforeunload/pagehide/visibilitychange 自动保存把新完整局写入 year 槽。

修复前使用真实设置回调、实际 SaveSystem，以及从 main.ts 提取的 persist 函数复现：原 year seed **777**、现金 **4,321**，操作后变成新 seed、现金 **12,000**；winter 槽被清除。即使只清完整局，同一退出保存也会重新创建该槽，不能完成清档。

修复：

- 设置根据当前场景明确要清除的模式，并在按钮、说明及原有确认框中说明保留另一槽。
- 清档后保留当前内存态，不创建另一个模式的新局。SaveSystem 可在清除成功时按槽抑制退出保存，main 的退出钩子改用 `saveOnExit`。
- 同一 reload 后续的多个退出事件均不能重建已清槽；以后明确的经营保存成功会恢复该槽正常保存。
- `clear` 返回成功与否；移除存储失败时显示原因并留在当前页面，不误报成功或 reload。

修复后用相同真实回调、真实 main persist 连续触发两次：winter 槽为空，year 仍为 **seed 777 / 现金 4,321**，内存仍是 winter。回归覆盖两种模式、连续退出事件、取消确认和存储移除失败。

## P2 · 重放接受错误公式、基线和终局声明（已修复）

触发条件：导出合法 `muyun-run-v1` 文件，仅修改评分相关声明而保留每周和最终物理指标，再调用 `replayRun`。原实现只校验 schema、模拟版本和部分 metrics；未检查导出公式、原始基线、终局状态和完整评分。

修复前真实模块复现：

- `assessmentFormulaVersion = 'incorrect-formula'`、`result.ended = false`、错误 cooperative 结局和 `result.assessment.overall = 999` 均被接受。
- 仅将 `baseline.netAssets` 改成 **1**，重放仍通过，却将同一记录从约 **52.73 分 / 维持经营**重算成约 **86.07 分 / 经营有余**。因此“指标一致”无法保证文件中的评分或结局声明成立。

修复：

- 重放要求当前评价公式版本；起点基线必须等于对记录起点重新计算的全部指标。
- 场景配置副本、scenario id、seed、记录起止周次和快照/记录类别必须一致。
- 重放完成后核对 ended、ending，并按当前公式重算完整 assessment；错误评分或结局拒绝。
- 数值比较不依赖 JSON 对象属性顺序，合法 v1 文件及属性重排后的等价 JSON 仍可重放。既有旧档续玩和完成快照回归继续通过。

边界：一致性重放不提供历史身份认证；如果作者同时构造一个完整、自洽的起点和行动序列，单个离线 JSON 无法证明它真实发生在某位玩家设备上。本轮没有加入账号签名或宣称可验证真实身份。

## 其他检查与后续建议

- 周结算确认具有一次性门控；事件在周推进后先持久化 pending 标记，继续存档会恢复事件；事件选择由生产规则再次校验并阻止重复执行。未发现本轮需要改动的正常恢复流程问题。
- 策略试算/局末对照在异步等待后检查面板是否仍连接，离开面板不会向新面板写入旧结果。成功、失败和重新运行路径已检查，无新增 P1/P2。
- 移动布局的“互动”按钮只绑定 `pointerdown`，全局键盘处理又明确忽略 button；聚焦按钮后用 Enter/Space 产生的原生 click 没有经营交互监听。已转交主代理的 UX/输入范围处理，本文件未改 InputManager。
- `InputManager.destroy()` 没有销毁 Joystick，Joystick 当前也没有移除其五个 DOM pointer 监听的方法；多次返回主菜单再进入场景会保留旧闭包。正常结束时旧控制通常已 disabled，当前以 **P3 生命周期维护项**记录，建议后续统一 teardown。
- 存档 log/动物子字段清理仍比周实验 JSON 验证宽松。局部损坏 JSON 的全面模式校验不在此次两项修复范围内，避免把兼容性迁移扩为新的格式升级；未将其当作正常经营路径中的数据损坏证据。

## 验证及改动范围

- 新增 12 项回归：`settings.test.ts` 增加 3 项，`replayIntegrity.test.ts` 新增 9 项。先观察错误实现下的失败，再完成修复。
- `npx vitest run tests/settings.test.ts tests/replayIntegrity.test.ts tests/decisionSave.test.ts tests/planner.test.ts tests/save.test.ts`：**5 文件、50 项全部通过**。
- `npx tsc --noEmit`：通过。
- 本轮指定文件的 `git diff --check`：通过（只有工作区原有 LF/CRLF 提示）。
- 实现范围：`client/src/ui/settings.ts`、`client/src/main.ts`、`client/src/systems/SaveSystem.ts`、`client/src/sim/replay.ts`；仅修改授权行为，保留工作区此前的其他改动。
