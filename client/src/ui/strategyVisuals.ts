import type { ExperimentPlan, ExperimentProjection, WeekExperiment } from '../sim/experiment';
import { PLAN_PROFILES } from '../sim/planner';
import type { PlanWeights, PlanningProfile } from '../sim/planner';
import { escapeHtml, yuan } from './panels/shared';

export const STRATEGY_PERSONAS: Readonly<Record<PlanningProfile, { description: string; icon: string }>> = {
  balanced: {
    description: '饲草之外兼顾三项',
    icon: '<path d="M12 3v17M6 21h12M4 7h16M6 7l-4 7h8L6 7Zm12 0-4 7h8l-4-7Z"/><path d="M2 14c.6 2 7.4 2 8 0m4 0c.6 2 7.4 2 8 0"/>',
  },
  ecology: {
    description: '更重视减轻草场退化',
    icon: '<path d="M12 21V10M12 16C4 16 3 10 4 4c6 0 10 5 8 12Zm0-3c0-6 4-9 8-9 1 6-1 10-8 11M6 7l6 9m6-8-6 7"/>',
  },
  assets: {
    description: '更重视本周净资产',
    icon: '<ellipse cx="9" cy="6" rx="6" ry="3"/><path d="M3 6v5c0 4 12 4 12 0V6M3 11v5c0 2.4 4.7 3.2 8 2.8"/><ellipse cx="17" cy="14" rx="4" ry="2.5"/><path d="M13 14v5c0 3.3 8 3.3 8 0v-5"/>',
  },
};

const WEIGHT_FIELDS: readonly { key: keyof PlanWeights; short: string; label: string }[] = [
  { key: 'feed', short: '饲草', label: '饲草覆盖' },
  { key: 'ecology', short: '草场', label: '草场状态' },
  { key: 'health', short: '健康', label: '健康评价' },
  { key: 'value', short: '资产', label: '净资产评价' },
];

function personaIcon(profile: PlanningProfile): string {
  return `<svg class="strategy-persona-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${STRATEGY_PERSONAS[profile].icon}</svg>`;
}

export function strategyProfilesMarkup(plans: readonly ExperimentPlan[]): string {
  return `<fieldset class="experiment-profiles strategy-personas"><legend>选择一个方案，查看行动与依据</legend>${plans.map(plan => {
    const profile = PLAN_PROFILES[plan.profile];
    const persona = STRATEGY_PERSONAS[plan.profile];
    return `<label class="strategy-persona strategy-persona--${plan.profile}">
      <input type="radio" name="strategy-profile" value="${plan.profile}" ${plan.profile === 'balanced' ? 'checked' : ''} aria-label="${escapeHtml(profile.label)}：${persona.description}" aria-describedby="strategy-profile-status-${plan.profile}" />
      <span class="strategy-persona-content"><span class="strategy-persona-heading">${personaIcon(plan.profile)}<strong>${escapeHtml(profile.label)}</strong></span>
        <span class="strategy-persona-description">${persona.description}</span>
        <span class="strategy-persona-weights">${WEIGHT_FIELDS.map(({ key, short, label }) => `<span class="strategy-persona-weight" aria-label="${label}权重 ${profile.weights[key]}"><span aria-hidden="true">${short}</span><span class="strategy-persona-weight-track" aria-hidden="true"><span style="width:${profile.weights[key]}%"></span></span></span>`).join('')}</span>
        <small id="strategy-profile-status-${plan.profile}" class="strategy-persona-status">${plan.safe ? '足草且结算现金为正' : '仍有饲草或现金风险'}</small>
        <span class="strategy-persona-selected" aria-hidden="true">已选择</span>
      </span></label>`;
  }).join('')}</fieldset>
  <details class="strategy-persona-weight-details"><summary>查看四项权重的精确数值</summary>
    <p class="modal-note">四条短线共用 0–100 的权重刻度。三种偏好都先比较足草与正现金，再按本组权重选择；权重不表示成功概率。</p>
    <div class="decision-table-wrap" role="region" aria-label="三种偏好的精确权重，窄屏可横向滚动" tabindex="0"><table class="data-table"><caption>三种偏好的评分权重</caption><thead><tr><th scope="col">偏好</th>${WEIGHT_FIELDS.map(field => `<th scope="col">${field.label}</th>`).join('')}</tr></thead><tbody>${plans.map(plan => `<tr><th scope="row">${escapeHtml(PLAN_PROFILES[plan.profile].label)}</th>${WEIGHT_FIELDS.map(field => `<td>${PLAN_PROFILES[plan.profile].weights[field.key]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </details>`;
}

type VisualMetricKey = 'feed' | 'degradation' | 'bcs' | 'assets';

interface VisualDimension {
  key: VisualMetricKey;
  label: string;
  minimum: number;
  maximum: number | null;
  scaleLabel: string;
  lowerIsBetter: boolean;
}

interface VisualMetric {
  key: VisualMetricKey;
  value: number | null;
  baseline: number | null;
  normalized: number | null;
  baselineNormalized: number | null;
  delta: number | null;
  direction: 'increase' | 'decrease' | 'same' | 'unavailable';
  clipped: 'below' | 'above' | null;
}

interface StrategyVisualSummary {
  dimensions: VisualDimension[];
  plans: { profile: PlanningProfile; metrics: VisualMetric[] }[];
  identical: boolean;
  startingNetAssets: number;
}

/**
 * Read only: every bar uses a declared domain shared by all three plans.
 * It never stretches the observed minimum/maximum into a full-width difference.
 * Assets use 0–2 times this experiment's input assets, not any plan's result.
 * These are raw metrics, not a reconstruction of planner H/V or a total score.
 */
export function buildStrategyVisualSummary(experiment: WeekExperiment, startingNetAssets: number): StrategyVisualSummary | null {
  if (!experiment.baseline) return null;
  const assetMaximum = Number.isFinite(startingNetAssets) && startingNetAssets > 0 ? startingNetAssets * 2 : null;
  const dimensions: VisualDimension[] = [
    { key: 'feed', label: '饲草覆盖', minimum: 0, maximum: 1, scaleLabel: '0–100%', lowerIsBetter: false },
    { key: 'degradation', label: '平均退化', minimum: 0, maximum: 1, scaleLabel: '0–100%', lowerIsBetter: true },
    { key: 'bcs', label: '平均体况 BCS', minimum: 1, maximum: 5, scaleLabel: '1–5', lowerIsBetter: false },
    { key: 'assets', label: '结算后净资产', minimum: 0, maximum: assetMaximum, scaleLabel: assetMaximum === null ? '起点不为正，显示金额' : '0–起点 2 倍', lowerIsBetter: false },
  ];
  const plans = experiment.plans.map(plan => ({
    profile: plan.profile,
    metrics: dimensions.map(dimension => {
      const value = rawMetric(plan, dimension.key);
      const baseline = rawMetric(experiment.baseline!, dimension.key);
      const delta = value === null || baseline === null ? null : value - baseline;
      const direction: VisualMetric['direction'] = delta === null ? 'unavailable' : Math.abs(delta) <= 1e-9 ? 'same' : delta > 0 ? 'increase' : 'decrease';
      return {
        key: dimension.key, value, baseline, delta, direction,
        normalized: normalizedMetric(value, dimension), baselineNormalized: normalizedMetric(baseline, dimension),
        clipped: dimension.maximum === null || value === null ? null
          : value < dimension.minimum ? 'below' as const : value > dimension.maximum ? 'above' as const : null,
      };
    }),
  }));
  const identical = plans.length > 1 && plans.slice(1).every(plan => plan.metrics.every((metric, index) => {
    const first = plans[0].metrics[index].value;
    return metric.value === first || (metric.value !== null && first !== null && Math.abs(metric.value - first) <= 1e-9);
  }));
  return { dimensions, plans, identical, startingNetAssets };
}

function rawMetric(projection: ExperimentProjection, key: VisualMetricKey): number | null {
  const value = key === 'feed' ? projection.feedNeedKg > 0 ? projection.feedCoverage : null
    : key === 'degradation' ? projection.metrics.averageDegradation
      : key === 'bcs' ? projection.metrics.aliveCount > 0 ? projection.metrics.averageBcs : null
        : projection.metrics.netAssets;
  return value !== null && Number.isFinite(value) ? value : null;
}

function normalizedMetric(value: number | null, dimension: VisualDimension): number | null {
  if (value === null || dimension.maximum === null || !Number.isFinite(dimension.maximum) || dimension.maximum <= dimension.minimum) return null;
  return Math.max(0, Math.min(1, (value - dimension.minimum) / (dimension.maximum - dimension.minimum)));
}

const visualNumber = (value: number, digits = 1): string => value.toLocaleString('zh-CN', { maximumFractionDigits: digits });

function metricValueLabel(metric: VisualMetric): string {
  if (metric.value === null) return metric.key === 'bcs' ? '无存栏' : metric.key === 'feed' ? '无需饲草' : '数据不可用';
  if (metric.key === 'assets') return yuan(metric.value);
  if (metric.key === 'bcs') return metric.value.toFixed(2);
  return `${visualNumber(metric.value * 100)}%`;
}

function metricDeltaLabel(metric: VisualMetric): string {
  if (metric.delta === null) return '无法与基线比较';
  if (metric.direction === 'same') return '＝ 无变化';
  const digits = metric.key === 'bcs' ? 2 : 1;
  const magnitude = Math.abs(metric.delta) * (metric.key === 'feed' || metric.key === 'degradation' ? 100 : 1);
  const rounded = Number(magnitude.toFixed(digits));
  const amount = rounded === 0 ? `不足 ${digits === 2 ? '0.01' : '0.1'}` : visualNumber(rounded, digits);
  const unit = metric.key === 'assets' ? ' 元' : metric.key === 'bcs' ? '' : ' 个百分点';
  return `${metric.direction === 'increase' ? '↑ 增加' : '↓ 减少'} ${amount}${unit}`;
}

export function strategyVisualSummaryMarkup(experiment: WeekExperiment, startingNetAssets: number): string {
  const result = buildStrategyVisualSummary(experiment, startingNetAssets);
  if (!result) return '';
  return `<section class="strategy-visual-summary" aria-labelledby="strategy-visual-title">
    <h4 id="strategy-visual-title">四项结果，看这次取舍</h4>
    <p class="strategy-visual-explainer">相对“不再行动”：↑ 增加，↓ 减少，＝ 无变化。虚线为共同基线；退化越低越好。各列量纲不同，条长只在同一列比较。</p>
    <div class="strategy-visual-grid" role="table" aria-label="三种偏好的四项原始结果与基线变化">
      <div class="strategy-visual-header" role="row"><span role="columnheader">经营偏好</span>${result.dimensions.map(dimension => `<span role="columnheader">${dimension.label}<small>${dimension.scaleLabel}<br>${dimension.lowerIsBetter ? '↓ 越低越好' : '↑ 越高越好'}</small></span>`).join('')}</div>
      ${result.plans.map(plan => `<div class="strategy-visual-row strategy-persona--${plan.profile}" role="row" data-profile="${plan.profile}"><strong class="strategy-visual-profile" role="rowheader">${personaIcon(plan.profile)}${escapeHtml(PLAN_PROFILES[plan.profile].label)}</strong>${plan.metrics.map((metric, index) => {
        const valueLabel = metricValueLabel(metric);
        const deltaLabel = metricDeltaLabel(metric);
        return `<div class="strategy-visual-cell" role="cell" aria-label="${escapeHtml(PLAN_PROFILES[plan.profile].label)}的${result.dimensions[index].label}：${valueLabel}；相对不再行动${deltaLabel}" data-metric="${metric.key}">
          <span class="strategy-visual-mobile-label" aria-hidden="true">${result.dimensions[index].label}</span><span class="strategy-visual-value">${valueLabel}</span>
          ${metric.normalized === null ? '<span class="strategy-visual-unavailable">无比例图示</span>' : `<span class="strategy-visual-meter" aria-hidden="true"><span class="strategy-visual-fill" style="width:${metric.normalized * 100}%"></span>${metric.baselineNormalized === null ? '' : `<span class="strategy-visual-baseline" style="left:${metric.baselineNormalized * 100}%"></span>`}</span>`}
          <span class="strategy-visual-delta">${deltaLabel}</span>${metric.clipped ? `<span class="strategy-visual-clipped">${metric.clipped === 'above' ? '超过图示上限' : '低于图示下限'}</span>` : ''}
        </div>`;
      }).join('')}</div>`).join('')}
    </div>
    ${result.identical ? '<p class="strategy-visual-equal">三种偏好的这四项结果相同，按相同长度显示。</p>' : ''}
    <p class="strategy-visual-scale">净资产以本次试算起点 ${yuan(startingNetAssets)} 为参考，${result.dimensions[3].maximum === null ? '起点不为正时只显示金额。' : `图示范围为 0–${yuan(result.dimensions[3].maximum!)}，超出刻度时封顶，金额照实显示。`}这是原始指标概览；体况不等于完整健康评价，净资产不等于现金或存栏保障。</p>
  </section>`;
}
