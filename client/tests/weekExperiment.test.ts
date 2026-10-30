import { describe, expect, it } from 'vitest';
import { assessRun } from '../src/sim/assessment';
import {
  compareWeekPlans, exportWeekExperiment, MAX_EXPERIMENT_JSON_LENGTH,
  verifyWeekExperiment, WEEK_EXPERIMENT_SCHEMA,
} from '../src/sim/experiment';
import { captureMetrics } from '../src/sim/history';
import { feedRequirementKg } from '../src/sim/nutrition';
import { MAX_EXPANDED_NODES, PLAN_PROFILES, planWeek } from '../src/sim/planner';
import type { PlanningProfile } from '../src/sim/planner';
import { actionStatus } from '../src/sim/rules';
import { applyAction, createRun } from '../src/sim/run';
import { createWinterChallenge } from '../src/sim/scenarios';
import { settleDeterministic } from '../src/sim/settlement';
import type { RunState } from '../src/sim/types';

const profiles: PlanningProfile[] = ['balanced', 'ecology', 'assets'];
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
function withoutTime<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (key, item) => key === 'elapsedMs' ? undefined : item));
}
function shortExport(): Record<string, any> {
  const state = { ...createWinterChallenge(), actionsLeft: 0 };
  return JSON.parse(exportWeekExperiment(state, compareWeekPlans(state)));
}

describe('profiled weekly planner', () => {
  it('publishes frozen weights and retains representative balanced decisions under the v2 budget', () => {
    expect(PLAN_PROFILES.balanced.weights).toEqual({ feed: 45, ecology: 20, health: 20, value: 15 });
    expect(PLAN_PROFILES.ecology.weights).toEqual({ feed: 45, ecology: 35, health: 15, value: 5 });
    expect(PLAN_PROFILES.assets.weights).toEqual({ feed: 45, ecology: 10, health: 15, value: 30 });
    expect(Object.isFrozen(PLAN_PROFILES)).toBe(true);
    profiles.forEach(profile => {
      expect(Object.isFrozen(PLAN_PROFILES[profile])).toBe(true);
      expect(Object.isFrozen(PLAN_PROFILES[profile].weights)).toBe(true);
    });
    const year = createRun(20261030);
    year.tech.scanned = true;
    const cases = [
      { state: year, actions: [{ kind: 'buy-hay', kg: 1700 }, { kind: 'buy-hay', kg: 1700 }, { kind: 'buy-hay', kg: 1700 }], score: 92.35655439311797, expanded: 437, assets: 177869 },
      { state: createWinterChallenge(), actions: [{ kind: 'sell', animalIds: ['yak-8'] }, { kind: 'graze', cellId: 'P1' }, { kind: 'cut-hay', cellId: 'P2' }], score: 87.75143741632421, expanded: 401, assets: 107373 },
      { state: { ...createWinterChallenge(), hayKg: 0 }, actions: [{ kind: 'buy-hay', kg: 1000 }, { kind: 'cut-hay', cellId: 'P2' }, { kind: 'graze', cellId: 'P1' }], score: 87.67093078423513, expanded: 444, assets: 101972 },
      { state: { ...createWinterChallenge(), actionsLeft: 0 }, actions: [], score: 87.34665017943807, expanded: 0, assets: 104967 },
    ];
    for (const entry of cases) {
      const actual = planWeek(entry.state);
      expect(actual.actions).toEqual(entry.actions);
      expect(actual.score).toBe(entry.score);
      expect(actual.expanded).toBe(entry.expanded);
      expect(actual.metrics.netAssets).toBe(entry.assets);
    }
  });

  it.each(profiles)('%s is legal, immutable, bounded and exposes honest score contributions', profile => {
    const state = freeze({ ...createWinterChallenge(), actionsLeft: 5, labor: 4, hayKg: 0 });
    const before = JSON.stringify(state);
    const plan = planWeek(state, profile);
    expect(JSON.stringify(state)).toBe(before);
    expect(plan.profile).toBe(profile);
    expect(plan.actions.length).toBeLessThanOrEqual(state.actionsLeft);
    expect(plan.expanded).toBeLessThanOrEqual(MAX_EXPANDED_NODES);
    const components = plan.components;
    expect(plan.score).toBe(components.feed.points + components.ecology.points + components.health.points + components.value.points);
    for (const key of ['feed', 'ecology', 'health', 'value'] as const) {
      expect(components[key].weight).toBe(PLAN_PROFILES[profile].weights[key]);
      expect(components[key].points).toBe(components[key].weight * components[key].value);
      expect(components[key].value).toBeGreaterThanOrEqual(0);
      expect(components[key].value).toBeLessThanOrEqual(1);
    }
    let trial = state;
    const cells = new Set<string>();
    for (const action of plan.actions) {
      expect(actionStatus(trial, action).reason).toBeNull();
      if (action.kind === 'graze' || action.kind === 'cut-hay') {
        expect(cells.has(action.cellId)).toBe(false);
        cells.add(action.cellId);
      }
      const next = applyAction(trial, action);
      expect(next).not.toBe(trial);
      expect(next.money).toBeGreaterThanOrEqual(0);
      trial = next;
    }
    expect(captureMetrics(trial).sheepUnits).toBeGreaterThanOrEqual(captureMetrics(state).sheepUnits / 2);
    const settled = settleDeterministic(trial);
    expect(plan.metrics).toEqual(captureMetrics(settled));
    expect(components.ecology.value).toBe(1 - plan.metrics.averageDegradation);
    const assessment = assessRun({ ...settled, tracking: { ...state.tracking!, baseline: captureMetrics(state) } });
    expect(components.health.value).toBe(assessment.health / 100);
    expect(components.value.value).toBe(assessment.economy / 100);
    expect(withoutTime(planWeek({ ...state, seed: 99 }, profile))).toEqual(withoutTime(plan));
  });
});

describe('current-state weekly experiment', () => {
  it('uses one no-action baseline and exactly executed prefixes without double settlement', () => {
    const source = freeze({ ...createWinterChallenge(), hayKg: 0 });
    const before = JSON.stringify(source);
    const experiment = compareWeekPlans(source);
    const baseline = experiment.baseline!;
    expect(experiment.plans.map(plan => plan.profile)).toEqual(profiles);
    expect(baseline.metrics).toEqual(captureMetrics(settleDeterministic(source)));
    expect(baseline.feedNeedKg).toBe(feedRequirementKg(source.animals.filter(a => a.alive)));
    expect(baseline.feedGapKg).toBe(Math.max(0, baseline.feedNeedKg - source.grazedKg - source.hayKg));
    expect(experiment.totalExpanded).toBe(experiment.plans.reduce((sum, plan) => sum + plan.expanded, 0));
    expect(experiment.totalExpanded).toBeLessThanOrEqual(3 * MAX_EXPANDED_NODES);
    for (const plan of experiment.plans) {
      let current = source;
      plan.steps.forEach((step, index) => {
        const status = actionStatus(current, plan.actions[index]);
        const next = applyAction(current, plan.actions[index]);
        expect(step.index).toBe(index + 1);
        expect(step.action).toEqual(plan.actions[index]);
        expect(step.cost).toBe(status.cost);
        expect(step.income).toBe(Math.max(0, next.money - current.money));
        expect(step.immediate).toEqual(captureMetrics(next));
        expect(step.settled).toEqual(captureMetrics(settleDeterministic(next)));
        expect(step.feedGapKg).toBe(Math.max(0, feedRequirementKg(next.animals.filter(a => a.alive)) - next.hayKg - next.grazedKg));
        current = next;
      });
      expect(plan.steps.at(-1)!.settled).toEqual(plan.metrics);
      for (const key of ['money', 'hayKg', 'netAssets', 'averageBcs', 'averageDegradation', 'grassKg', 'sheepUnits'] as const) {
        expect(plan.delta[key]).toBe(plan.metrics[key] - baseline.metrics[key]);
      }
      expect(plan.delta.feedGapKg).toBe(plan.feedGapKg - baseline.feedGapKg);
    }
    expect(JSON.stringify(source)).toBe(before);
    expect(source.tracking!.pending).toEqual([]);
    expect(source.tracking!.weeks).toEqual([]);
  });

  it('honestly references identical sequences and keeps the current baseline independent of old history', () => {
    const state = { ...createWinterChallenge(), actionsLeft: 0 };
    const experiment = compareWeekPlans(state);
    expect(experiment.plans.map(plan => plan.sameActionsAs)).toEqual([null, 'balanced', 'balanced']);
    expect(experiment.plans.every(plan => plan.actions.length === 0 && plan.steps.length === 0)).toBe(true);
    const changed = { ...state, tracking: { ...state.tracking!, baseline: { ...state.tracking!.baseline, netAssets: 1, deaths: 99 } } };
    expect(withoutTime(compareWeekPlans(changed))).toEqual(withoutTime(experiment));
  });

  it('does no searches when locked or ended, and labels a genuine shortage when no safe plan exists', () => {
    for (const state of [createRun(7), { ...createWinterChallenge(), ended: true }]) {
      const experiment = compareWeekPlans(freeze(state));
      expect(experiment.lockedReason).toBeTruthy();
      expect(experiment.baseline).toBeNull();
      expect(experiment.plans).toEqual([]);
      expect(experiment.totalExpanded).toBe(0);
      expect(verifyWeekExperiment(exportWeekExperiment(state, experiment)).valid).toBe(true);
    }
    const state = { ...createWinterChallenge(), money: 0, hayKg: 0, actionsLeft: 0 };
    const experiment = compareWeekPlans(state);
    expect(experiment.baseline!.safe).toBe(false);
    expect(experiment.plans.every(plan => !plan.safe && plan.feedGapKg > 0)).toBe(true);
  });

  it('keeps immediate sale income distinct from hypothetical settlement costs', () => {
    const state = createWinterChallenge();
    const experiment = compareWeekPlans(state);
    const sale = experiment.plans.find(plan => plan.steps.some(step => step.action.kind === 'sell'))!;
    const step = sale.steps.find(item => item.action.kind === 'sell')!;
    expect(step.cost).toBe(0);
    expect(step.income).toBeGreaterThan(0);
    expect(step.immediate.money).toBe(state.money + step.income);
    expect(step.settled.money).toBe(step.immediate.money - step.immediate.weeklyCost);
  });
});

describe('independent reproducible experiment export', () => {
  it('round-trips current input, manifests and actual hypothetical outcomes without real run history', () => {
    const state = freeze(createWinterChallenge());
    const before = JSON.stringify(state);
    const experiment = compareWeekPlans(state);
    const serialized = exportWeekExperiment(state, experiment);
    const payload = JSON.parse(serialized);
    expect(payload.schema).toBe(WEEK_EXPERIMENT_SCHEMA);
    expect(payload.input.tracking).toBeUndefined();
    expect(payload.input.log).toEqual([]);
    expect(payload.input.usedEvents).toEqual([]);
    expect(payload.input.flags).toEqual({});
    expect(payload.method.profiles).toEqual(PLAN_PROFILES);
    expect(payload.method.constraints.minimumRetainedSheepUnits).toBe(captureMetrics(state).sheepUnits / 2);
    const verified = verifyWeekExperiment(serialized);
    expect(verified.valid, verified.reason).toBe(true);
    expect(withoutTime(verified.experiment)).toEqual(withoutTime(experiment));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('materializes current-week pasture use that exists only in pending decisions', () => {
    const original = createWinterChallenge();
    const state: RunState = { ...original, actionsLeft: 1,
      pasture: original.pasture.map(cell => ({ ...cell, restedWeeks: 3, grazing: false, harvested: false })),
      tracking: { ...original.tracking!, pending: [{ kind: 'action', action: { kind: 'cut-hay', cellId: 'P1' } }] },
    };
    const experiment = compareWeekPlans(freeze(state));
    const serialized = exportWeekExperiment(state, experiment);
    const payload = JSON.parse(serialized);
    expect(payload.input.pasture[0]).toMatchObject({ harvested: true, grazing: false, restedWeeks: 0 });
    expect(experiment.baseline!.metrics).toEqual(captureMetrics(settleDeterministic(state)));
    expect(experiment.plans.every(plan => !plan.actions.some(a => 'cellId' in a && a.cellId === 'P1'))).toBe(true);
    expect(verifyWeekExperiment(serialized).valid).toBe(true);
    for (const plan of experiment.plans) expect(plan.actions).toEqual(planWeek(state, plan.profile).actions);
  });

  it('refuses stale UI exports after the real state changes', () => {
    const state = createWinterChallenge();
    const experiment = compareWeekPlans(state);
    expect(() => exportWeekExperiment({ ...state, money: state.money + 1 }, experiment)).toThrow('重新运行');
    expect(() => exportWeekExperiment(state, { ...experiment, plannerVersion: 'old' as any })).toThrow('版本');
  });

  it('ignores only finite wall-clock timing and accepts JSON key reordering', () => {
    const payload = shortExport();
    payload.output.plans.forEach((plan: any) => { plan.elapsedMs = 999.123; });
    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    expect(verifyWeekExperiment(JSON.stringify(reordered)).valid).toBe(true);
    payload.output.plans[0].elapsedMs = -1;
    expect(verifyWeekExperiment(JSON.stringify(payload)).valid).toBe(false);
  });

  it.each([
    ['版本', (p: any) => { p.plannerVersion = 'beam-profile-v1'; }],
    ['模拟版本', (p: any) => { p.simulationVersion = 'old-engine'; }],
    ['元数据', (p: any) => { p.method.width += 1; }],
    ['公开权重', (p: any) => { p.method.profiles.ecology.weights.ecology += 1; }],
    ['输入', (p: any) => { p.input.money += 1; }],
    ['基线', (p: any) => { p.output.baseline.metrics.money += 1; }],
    ['行动', (p: any) => { p.output.plans[0].actions.push({ kind: 'buy-hay', kg: 100 }); }],
    ['得分分量', (p: any) => { p.output.plans[0].components.feed.points += 1; }],
    ['搜索量', (p: any) => { p.output.totalExpanded += 1; }],
    ['相同行动引用', (p: any) => { p.output.plans[1].sameActionsAs = null; }],
    ['额外输出', (p: any) => { p.output.unverified = true; }],
  ])('rejects %s tampering instead of certifying altered evidence', (_label, mutate) => {
    const payload = shortExport();
    mutate(payload);
    const result = verifyWeekExperiment(JSON.stringify(payload));
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(result.experiment).toBeUndefined();
  });

  it('rejects altered prefix immediate/settlement effects', () => {
    const state = { ...createWinterChallenge(), actionsLeft: 1 };
    const serialized = exportWeekExperiment(state, compareWeekPlans(state));
    const payload = JSON.parse(serialized);
    expect(payload.output.plans[0].steps.length).toBe(1);
    payload.output.plans[0].steps[0].immediate.hayKg += 1;
    expect(verifyWeekExperiment(JSON.stringify(payload)).valid).toBe(false);
  });

  it.each([
    ['重复牲畜', (p: any) => { p.input.animals[1].id = p.input.animals[0].id; }],
    ['重复草场', (p: any) => { p.input.pasture[1].id = p.input.pasture[0].id; }],
    ['非法数值', (p: any) => { p.input.animals[0].weightKg = -1; }],
    ['过多行动', (p: any) => { p.input.actionsLeft = 6; }],
    ['未知物种', (p: any) => { p.input.animals[0].species = 'unknown'; }],
    ['递归历史', (p: any) => { p.input.tracking = {}; }],
    ['过多牲畜', (p: any) => { p.input.animals = Array(1001).fill(p.input.animals[0]); }],
    ['过多草场', (p: any) => { p.input.pasture = Array(5).fill(p.input.pasture[0]); }],
    ['无效面积', (p: any) => { p.input.pasture[0].areaHa = 0; }],
  ])('bounds and rejects %s untrusted input', (_label, mutate) => {
    const payload = shortExport();
    mutate(payload);
    expect(verifyWeekExperiment(JSON.stringify(payload)).valid).toBe(false);
  });

  it('returns friendly results for malformed, oversized, nonfinite and deeply nested data', () => {
    for (const value of [null, {}, 'bad-json', '{}', ' '.repeat(MAX_EXPERIMENT_JSON_LENGTH + 1), '{"number":1e999}', '{"__proto__":{}}']) {
      expect(() => verifyWeekExperiment(value)).not.toThrow();
      expect(verifyWeekExperiment(value).valid).toBe(false);
    }
    expect(verifyWeekExperiment('['.repeat(50) + '0' + ']'.repeat(50)).reason).toContain('嵌套');
  });

  it('supports empty deterministic boundaries without NaN or invented actions', () => {
    const state = { ...createWinterChallenge(), animals: [], pasture: [], actionsLeft: 0, hayKg: 0 };
    const experiment = compareWeekPlans(state);
    expect(experiment.baseline!.feedCoverage).toBe(1);
    expect(experiment.plans.every(plan => Number.isFinite(plan.score) && plan.actions.length === 0)).toBe(true);
    expect(verifyWeekExperiment(exportWeekExperiment(state, experiment)).valid).toBe(true);
  });

  it('treats optional undefined animal fields according to JSON serialization', () => {
    const original = createWinterChallenge();
    const state = { ...original, actionsLeft: 0,
      animals: original.animals.map(animal => ({ ...animal, exitReason: undefined, exitWeek: undefined })),
    };
    const experiment = compareWeekPlans(state);
    expect(verifyWeekExperiment(exportWeekExperiment(state, experiment)).valid).toBe(true);
  });
});
