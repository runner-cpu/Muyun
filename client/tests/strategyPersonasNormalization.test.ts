import { describe, expect, it } from 'vitest';
import { compareWeekPlans } from '../src/sim/experiment';
import { createWinterChallenge } from '../src/sim/scenarios';
import { experimentMarkup } from '../src/ui/panels/strategyView';
import { buildStrategyVisualSummary, STRATEGY_PERSONAS } from '../src/ui/strategyVisuals';

function fixture() {
  const state = { ...createWinterChallenge(), actionsLeft: 0 };
  const experiment = compareWeekPlans(state);
  experiment.baseline!.feedCoverage = 0.6;
  Object.assign(experiment.baseline!.metrics, { averageDegradation: 0.3, averageBcs: 3, netAssets: 10000 });
  const plan = experiment.plans[0];
  plan.feedCoverage = 0.8;
  Object.assign(plan.metrics, { averageDegradation: 0.25, averageBcs: 3, netAssets: 15000 });
  return { state, experiment };
}

describe('策略结果的共同刻度', () => {
  it('按明确固定范围展示四项原始指标，并从同一不行动基线计算方向', () => {
    const { experiment } = fixture();
    const result = buildStrategyVisualSummary(experiment, 10000)!;
    expect(result.plans[0].metrics.map(metric => metric.normalized)).toEqual([0.8, 0.25, 0.5, 0.75]);
    expect(result.plans[0].metrics.map(metric => metric.baselineNormalized)).toEqual([0.6, 0.3, 0.5, 0.5]);
    expect(result.plans[0].metrics.map(metric => metric.direction)).toEqual(['increase', 'decrease', 'same', 'increase']);
    expect(result.plans[0].metrics[1].delta).toBeCloseTo(-0.05);
    expect(result.plans[0].metrics[3].delta).toBe(5000);
    expect(result.dimensions.map(dimension => dimension.lowerIsBetter)).toEqual([false, true, false, false]);
  });

  it('其他方案改变时不重拉当前方案的刻度，并为超出范围的真实金额封顶', () => {
    const { experiment } = fixture();
    experiment.plans[1].metrics.netAssets = 9000000;
    experiment.plans[2].metrics.averageDegradation = 0.249;
    const result = buildStrategyVisualSummary(experiment, 10000)!;
    expect(result.plans[0].metrics[3].normalized).toBe(0.75);
    expect(result.plans[1].metrics[3]).toMatchObject({ value: 9000000, normalized: 1, clipped: 'above' });
    expect(result.plans[2].metrics[1].normalized).toBe(0.249);
    experiment.plans[0].metrics.netAssets = -100;
    expect(buildStrategyVisualSummary(experiment, 10000)!.plans[0].metrics[3])
      .toMatchObject({ value: -100, normalized: 0, clipped: 'below' });
  });

  it('相同结果保持相同长度，零净资产起点、无存栏和缺少基线不产生假满条', () => {
    const state = { ...createWinterChallenge(), actionsLeft: 0 };
    const experiment = compareWeekPlans(state);
    const result = buildStrategyVisualSummary(experiment, 10000)!;
    expect(result.identical).toBe(true);
    for (const plan of result.plans) {
      expect(plan.metrics.map(metric => metric.normalized)).toEqual(result.plans[0].metrics.map(metric => metric.normalized));
      expect(plan.metrics.map(metric => metric.direction)).toEqual(['same', 'same', 'same', 'same']);
    }
    experiment.plans[0].metrics.aliveCount = 0;
    const noRatio = buildStrategyVisualSummary(experiment, 0)!;
    expect(noRatio.plans[0].metrics[2].normalized).toBeNull();
    expect(noRatio.plans[0].metrics[3].normalized).toBeNull();
    expect(buildStrategyVisualSummary({ ...experiment, baseline: null }, 10000)).toBeNull();
  });

  it('摘要先于数值表出现，标明量纲、低值方向、基线变化和相同结果', () => {
    const state = { ...createWinterChallenge(), actionsLeft: 0 };
    const experiment = compareWeekPlans(state);
    const markup = experimentMarkup(state, experiment);
    expect(markup.indexOf('class="strategy-visual-summary"')).toBeGreaterThan(-1);
    expect(markup.indexOf('class="strategy-visual-summary"')).toBeLessThan(markup.indexOf('class="data-table experiment-table"'));
    expect(markup).toContain('↓ 越低越好');
    expect(markup).toContain('相对“不再行动”');
    expect(markup).toContain('1–5');
    expect(markup).toContain('起点 2 倍');
    expect(markup).toContain('超出刻度时封顶');
    expect(markup).toContain('这四项结果相同');
    expect(markup).toContain('＝ 无变化');
    expect(markup).not.toContain('NaN');
  });

  it('短句不超过十二个字，资产偏好只陈述净资产取向', () => {
    for (const persona of Object.values(STRATEGY_PERSONAS)) expect([...persona.description].length).toBeLessThanOrEqual(12);
    expect(STRATEGY_PERSONAS.assets.description).toContain('净资产');
    expect(STRATEGY_PERSONAS.assets.description).not.toMatch(/保住|保证|必定/);
  });
});
