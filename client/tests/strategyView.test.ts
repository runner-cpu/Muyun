import { describe, expect, it } from 'vitest';
import { compareWeekPlans } from '../src/sim/experiment';
import { PLAN_PROFILES } from '../src/sim/planner';
import { createRun } from '../src/sim/run';
import { createWinterChallenge } from '../src/sim/scenarios';
import { experimentMarkup, experimentPlanMarkup, isPlanningProfile } from '../src/ui/panels/strategyView';

describe('周策略实验的可解释界面', () => {
  it('在同一表中提供不行动基线与三组原始指标，不把不同权重总分排名', () => {
    const state = createWinterChallenge();
    const experiment = compareWeekPlans(state);
    const before = JSON.stringify(state);
    const markup = experimentMarkup(state, experiment);
    expect(markup).toContain('不再行动');
    for (const profile of Object.values(PLAN_PROFILES)) expect(markup).toContain(profile.label);
    expect(markup).toContain('相对这条基线的变化');
    expect(markup).toContain('结算后净资产');
    expect(markup).toContain('共同基线');
    expect(markup).toContain('不与其他权重的总分排名');
    expect(markup).toContain('导出本周实验单');
    expect(markup).not.toContain('自动执行');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('相同动作如实提示，并将零行动与不能找到安全方案区分', () => {
    const state = { ...createWinterChallenge(), actionsLeft: 0 };
    const experiment = compareWeekPlans(state);
    expect(experimentMarkup(state, experiment)).toContain('相同行动序列');
    const plan = experiment.plans[0];
    expect(experimentPlanMarkup(state, plan)).toContain('保留行动点');
    const risky = compareWeekPlans({ ...state, hayKg: 0, grazedKg: 0, money: 0 }).plans[0];
    expect(experimentPlanMarkup(state, risky)).toContain('未找到同时满足足草与正现金');
  });

  it('把每个前缀的即刻资源和假设结算分开，评分使用当前偏好真实贡献', () => {
    const state = { ...createWinterChallenge(), hayKg: 0 };
    const experiment = compareWeekPlans(state);
    expect(experiment.plans).toHaveLength(3);
    for (const plan of experiment.plans) {
      const markup = experimentPlanMarkup(state, plan);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(markup).toContain('行动后即刻现金');
      expect(markup).toContain('若此时结算 · 现金');
      expect(markup).toContain('亲自执行');
      expect(markup).toContain(plan.components.ecology.points.toFixed(2));
      expect(markup).toContain(plan.score.toFixed(2));
    }
  });

  it('监测锁定时不给出可导出实验；偏好输入拒绝原型属性', () => {
    const state = createRun(1);
    const markup = experimentMarkup(state, compareWeekPlans(state));
    expect(markup).toContain('监测');
    expect(markup).not.toContain('strategy-export');
    expect(isPlanningProfile('balanced')).toBe(true);
    expect(isPlanningProfile('__proto__')).toBe(false);
    expect(isPlanningProfile('constructor')).toBe(false);
  });

  it('小于一公斤的真实风险保持可见，小变化归零后不显示负零', () => {
    const state = createWinterChallenge();
    const experiment = compareWeekPlans(state);
    const plan = experiment.plans[0];
    plan.delta.money = -0.001;
    plan.delta.hayKg = -0.001;
    plan.feedGapKg = 0.4;
    plan.safe = false;
    const markup = experimentMarkup(state, experiment);
    expect(markup).toContain('不足 1 kg');
    expect(markup).not.toContain('-0 元');
    expect(markup).not.toContain('-0 kg');
    expect(markup).toContain('请先核对剩余风险');
  });
});
