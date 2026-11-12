import type { ExperimentPlan, ExperimentProjection, WeekExperiment } from '../../sim/experiment';
import { captureMetrics } from '../../sim/history';
import { PLAN_PROFILES } from '../../sim/planner';
import type { PlanWeights, PlanningProfile } from '../../sim/planner';
import type { RunState } from '../../sim/types';
import { strategyProfilesMarkup, strategyVisualSummaryMarkup } from '../strategyVisuals';
import { actionDescription, formatKg } from './reviewView';
import { escapeHtml, percent, yuan } from './shared';

const number = (value: number, digits = 1): string => value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
const signed = (value: number, unit = '', digits = 1): string => {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? '+' : ''}${number(rounded === 0 ? 0 : rounded, digits)}${unit}`;
};
const feedGap = (value: number): string => value <= 1e-6 ? '0 kg' : value < 1 ? '不足 1 kg' : `${number(value)} kg`;

interface MetricRow {
  label: string;
  value: (projection: ExperimentProjection) => string;
  delta: (plan: ExperimentPlan) => string;
}

const ROWS: MetricRow[] = [
  { label: '本周饲草缺口', value: p => feedGap(p.feedGapKg), delta: p => signed(p.delta.feedGapKg, ' kg') },
  { label: '结算后现金', value: p => yuan(p.metrics.money), delta: p => `${signed(p.delta.money)} 元` },
  { label: '结算后干草', value: p => formatKg(p.metrics.hayKg), delta: p => signed(p.delta.hayKg, ' kg') },
  { label: '平均草场退化', value: p => `${number(p.metrics.averageDegradation * 100)}%`, delta: p => signed(p.delta.averageDegradation * 100, ' 个百分点') },
  { label: '平均体况 BCS', value: p => p.metrics.averageBcs.toFixed(2), delta: p => signed(p.delta.averageBcs, '', 2) },
  { label: '结算后净资产', value: p => yuan(p.metrics.netAssets), delta: p => `${signed(p.delta.netAssets)} 元` },
];

function metricsTable(experiment: WeekExperiment, rows: MetricRow[], caption: string): string {
  const baseline = experiment.baseline!;
  return `<div class="decision-table-wrap" role="region" aria-label="${caption}，窄屏可横向滚动" tabindex="0"><table class="data-table experiment-table">
    <caption>${caption}</caption><thead><tr><th scope="col">指标</th><th scope="col">不再行动</th>${experiment.plans.map(plan => `<th scope="col">${escapeHtml(PLAN_PROFILES[plan.profile].label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr><th scope="row">${row.label}</th><td>${row.value(baseline)}<small>共同基线</small></td>${experiment.plans.map(plan => `<td>${row.value(plan)}<small>${row.delta(plan)}</small></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function experimentMarkup(state: RunState, experiment: WeekExperiment): string {
  if (experiment.lockedReason || !experiment.baseline) return `<p class="decision-notice">${escapeHtml(experiment.lockedReason ?? '本次试算没有可显示的结果，请重试。')}</p>`;
  const same = experiment.plans.filter(plan => plan.sameActionsAs);
  return `<section class="experiment-comparison" aria-labelledby="strategy-result-title">
    <h3 id="strategy-result-title" tabindex="-1">同一起点，比较三种经营取舍</h3>
    <p class="modal-note">均使用第 ${state.week} 周的当前配置。“不再行动”表示直接进入确定性结算；下方小字为各方案相对这条基线的变化。缺口与退化越低越好。</p>
    ${strategyProfilesMarkup(experiment.plans)}
    ${strategyVisualSummaryMarkup(experiment, captureMetrics(state).netAssets)}
    ${metricsTable(experiment, ROWS, '同一确定性阶段的预估 · 不含未来随机结果')}
    ${same.length ? `<p class="experiment-same">${same.map(plan => `${escapeHtml(PLAN_PROFILES[plan.profile].label)}与${escapeHtml(PLAN_PROFILES[plan.sameActionsAs!].label)}得到相同行动序列。`).join('')}当前条件下，偏好不同也可能选择相同。</p>` : ''}
    <details class="experiment-more"><summary>查看草量、存栏与行动预算</summary>${metricsTable(experiment, [
      { label: '结算后草量', value: p => formatKg(p.metrics.grassKg), delta: p => signed(p.delta.grassKg, ' kg') },
      { label: '结算后存栏', value: p => `${p.metrics.aliveCount} 头`, delta: p => signed(p.metrics.aliveCount - experiment.baseline!.metrics.aliveCount, ' 头', 0) },
      { label: '存栏羊单位', value: p => number(p.metrics.sheepUnits), delta: p => signed(p.delta.sheepUnits) },
    ], '同起点的补充指标')}<p class="modal-note">行动预算 ${state.actionsLeft} 点；${experiment.plans.map(plan => `${escapeHtml(PLAN_PROFILES[plan.profile].label)}使用 ${plan.actions.length} 点`).join('，')}。未使用的行动点不会带到下一周。</p></details>
    <div id="strategy-plan">${experimentPlanMarkup(state, experiment.plans.find(plan => plan.profile === 'balanced')!)}</div>
    <div class="experiment-export"><div><h3>保存这次周实验</h3><p>包含起点、三种权重、共同基线、行动与预测，可用本项目命令行复算。</p></div><button type="button" class="pixel-btn" id="strategy-export">导出本周实验单</button></div>
    <p id="strategy-export-status" class="modal-note" aria-live="polite"></p>
    <button type="button" class="pixel-btn" id="strategy-repeat">重新计算三种偏好</button>
    <p class="modal-note">三种偏好合计搜索 ${number(experiment.totalExpanded, 0)} 个节点。${experiment.plans.map(plan => `${escapeHtml(PLAN_PROFILES[plan.profile].label)} ${plan.elapsedMs.toFixed(1)} ms`).join('；')}。有限搜索不保证最优。</p>
  </section>`;
}

export function experimentPlanMarkup(state: RunState, plan: ExperimentPlan): string {
  const profile = PLAN_PROFILES[plan.profile];
  const components: [keyof PlanWeights, string][] = [['feed', 'F 饲草覆盖'], ['ecology', 'E 草场状态'], ['health', 'H 健康评价'], ['value', 'V 资产评价']];
  const spending = plan.steps.reduce((sum, step) => sum + step.cost, 0);
  const income = plan.steps.reduce((sum, step) => sum + step.income, 0);
  const retainedFloor = state.tracking ? state.tracking.baseline.sheepUnits * .5 : null;
  const retainedMargin = retainedFloor === null ? null : plan.metrics.sheepUnits - retainedFloor;
  return `<section class="experiment-plan ${plan.safe ? '' : 'experiment-plan-risk'}" aria-label="${escapeHtml(profile.label)}方案明细">
    <div class="decision-section-title"><h3>${escapeHtml(profile.label)} · ${plan.actions.length} 个行动</h3><span class="status-label">${plan.safe ? '确定性条件满足' : '请先核对剩余风险'}</span></div>
    <p>${escapeHtml(profile.description)}</p>
    ${plan.safe ? '' : `<p class="danger-text">仍缺草 ${feedGap(plan.feedGapKg)}，结算后现金 ${yuan(plan.metrics.money)}。当前搜索未找到同时满足足草与正现金的方案。</p>`}
    ${plan.sameActionsAs ? `<p class="modal-note">行动与${escapeHtml(PLAN_PROFILES[plan.sameActionsAs].label)}一致；下方按当前偏好解释评分。</p>` : ''}
    <dl class="decision-facts"><div><dt>行动现金支出</dt><dd>${yuan(spending)}</dd></div><div><dt>行动出售收入</dt><dd>${yuan(income)}</dd></div><div><dt>使用 / 可用行动点</dt><dd>${plan.actions.length} / ${state.actionsLeft}</dd></div><div><dt>本周饲草覆盖</dt><dd>${percent(plan.feedCoverage)}</dd></div></dl>
    ${retainedMargin === null ? '' : `<p class="${retainedMargin < 0 ? 'danger-text' : 'modal-note'}">局末保留目标 ≥ ${number(retainedFloor!)} 羊单位，固定参考本局记录起点；本方案结算后 ${number(plan.metrics.sheepUnits)}，${retainedMargin >= 0 ? `距离下限余 ${number(retainedMargin)}` : `低于下限 ${number(-retainedMargin)}`} 羊单位。本周足草且现金为正，也可能无法达到局末最高成果。</p>`}
    ${plan.steps.length ? `<ol class="decision-plan-steps experiment-steps">${plan.steps.map(step => `<li><strong>${escapeHtml(actionDescription(state, step.action))}</strong><span>1 行动点 · ${step.cost > 0 ? `支出 ${yuan(step.cost)}` : step.income > 0 ? `收入 ${yuan(step.income)}` : '不花现金'}</span><details><summary>查看做到这一步的变化</summary><dl class="experiment-step-facts"><div><dt>行动后即刻现金</dt><dd>${yuan(step.immediate.money)}</dd></div><div><dt>行动后即刻干草</dt><dd>${formatKg(step.immediate.hayKg)}</dd></div><div><dt>若此时结算 · 现金</dt><dd>${yuan(step.settled.money)}</dd></div><div><dt>若此时结算 · 干草</dt><dd>${formatKg(step.settled.hayKg)}</dd></div><div><dt>本周剩余饲草缺口</dt><dd>${feedGap(step.feedGapKg)}</dd></div><div><dt>若此时结算 · 平均 BCS</dt><dd>${step.settled.averageBcs.toFixed(2)}</dd></div></dl></details></li>`).join('')}</ol>` : `<p class="experiment-empty">${plan.safe ? '当前方案建议保留行动点，按已有安排结算。' : '当前搜索未找到更好的行动序列，可返回经营面板检查其他安排。'}</p>`}
    <p class="modal-note">以上仅为参考。请记下动作顺序、草场和耳标，在经营面板亲自执行；每次改变安排后，可按新状态重新试算。</p>
    <details class="experiment-score"><summary>为什么选择它：查看这组权重的分项贡献</summary>
      <div class="decision-table-wrap" role="region" aria-label="当前偏好的评分贡献" tabindex="0"><table class="data-table"><caption>仅解释当前偏好，不与其他权重的总分排名</caption><thead><tr><th scope="col">分项</th><th scope="col">归一化值</th><th scope="col">权重</th><th scope="col">贡献</th></tr></thead><tbody>${components.map(([key, label]) => `<tr><th scope="row">${label}</th><td>${percent(plan.components[key].value)}</td><td>${plan.components[key].weight}</td><td>${plan.components[key].points.toFixed(2)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row" colspan="3">本偏好目标分</th><td>${plan.score.toFixed(2)}</td></tr></tfoot></table></div>
      <p class="modal-note">先比较“足草且结算现金为正”，再在组内按本偏好目标分、较短行动序列和固定顺序选择。分项四舍五入后可能与总和有尾差。</p>
      <p class="modal-note">本周搜索不优化整局使命，也不估算长期经营收益。净资产把干草按固定冬季价格计值，低价购草可能提升账面估值；库存较多、目标分较高不代表长期经营更好。</p>
    </details>
  </section>`;
}

export function isPlanningProfile(value: string): value is PlanningProfile {
  return Object.hasOwn(PLAN_PROFILES, value);
}
