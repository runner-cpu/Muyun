import { describe, expect, it, vi } from 'vitest';
import { createAnimal } from '../src/sim/animal';
import { captureMetrics, ensureTracking } from '../src/sim/history';
import { feedRequirementKg } from '../src/sim/nutrition';
import { sheepUnitEquivalent } from '../src/sim/pasture';
import { MAX_EXPANDED_NODES, planWeek } from '../src/sim/planner';
import { comparePolicies, playGreedyWeek, policyOutcome, simulatePolicy } from '../src/sim/policies';
import { exportRun, replayRun, restoreRunOrigin } from '../src/sim/replay';
import { actionStatus } from '../src/sim/rules';
import { applyAction, createRun } from '../src/sim/run';
import { settleDeterministic } from '../src/sim/settlement';
import type { RunState } from '../src/sim/types';
import { SaveSystem } from '../src/systems/SaveSystem';

function experiment(actionsLeft = 3): RunState {
  const initial = createRun(20261030);
  const { tracking: _tracking, ...plain } = initial;
  return ensureTracking({ ...plain, tech: { ...plain.tech, scanned: true }, actionsLeft });
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

describe('weekly constrained search', () => {
  it('requires monitoring and never expands a locked or finished run', () => {
    const state = freeze(createRun(91));
    const before = JSON.stringify(state);
    const locked = planWeek(state);
    expect(locked.lockedReason).toContain('监测');
    expect(locked.expanded).toBe(0);
    expect(locked.actions).toEqual([]);
    expect(planWeek({ ...experiment(), ended: true }).expanded).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps the input immutable and every returned step legal within AP and cell bounds', () => {
    const state = freeze({ ...experiment(5), labor: 4, hayKg: 0 });
    const before = JSON.stringify(state);
    const plan = planWeek(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(plan.actions.length).toBeLessThanOrEqual(5);
    expect(plan.expanded).toBeGreaterThan(0);
    expect(plan.expanded).toBeLessThanOrEqual(MAX_EXPANDED_NODES);
    const cells = plan.actions.flatMap(a => a.kind === 'graze' || a.kind === 'cut-hay' ? [a.cellId] : []);
    expect(new Set(cells).size).toBe(cells.length);
    let executed = state;
    for (const action of plan.actions) {
      expect(actionStatus(executed, action).reason).toBeNull();
      const next = applyAction(executed, action);
      expect(next).not.toBe(executed);
      expect(next.money).toBeGreaterThanOrEqual(0);
      executed = next;
    }
    const units = (s: RunState) => s.animals.filter(a => a.alive).reduce((n, a) => n + sheepUnitEquivalent(a), 0);
    expect(units(executed)).toBeGreaterThanOrEqual(units(state) / 2);
    expect(captureMetrics(settleDeterministic(executed))).toEqual(plan.metrics);
  });

  it('never reuses a pasture already worked in the current week', () => {
    const state = applyAction(experiment(), { kind: 'cut-hay', cellId: 'P1' });
    const plan = planWeek(state);
    expect(plan.actions.some(a => (a.kind === 'graze' || a.kind === 'cut-hay') && a.cellId === 'P1')).toBe(false);
    const { tracking: _tracking, ...withoutHistory } = state;
    const flagged = planWeek(withoutHistory);
    expect(flagged.actions.some(a => (a.kind === 'graze' || a.kind === 'cut-hay') && a.cellId === 'P1')).toBe(false);
    expect(flagged.expanded).toBeLessThanOrEqual(MAX_EXPANDED_NODES);
  });

  it('is deterministic apart from elapsed time and cannot inspect seed-specific future outcomes', () => {
    const state = experiment(2);
    const { elapsedMs: _first, ...first } = planWeek(state);
    const { elapsedMs: _second, ...second } = planWeek(state);
    const { elapsedMs: _otherSeed, ...otherSeed } = planWeek({ ...state, seed: 7 });
    expect(second).toEqual(first);
    expect(otherSeed).toEqual(first);
  });

  it('prioritizes a safe feeding plan and can stop without spending spare AP', () => {
    const initial = experiment(1);
    const sheep = { ...initial.animals.find(a => a.species === 'sheep')!, weightKg: 10 };
    const { tracking: _tracking, ...plain } = initial;
    const state = ensureTracking({ ...plain, animals: [sheep], money: 800, hayKg: 0,
      pasture: plain.pasture.map(c => ({ ...c, biomassKgPerHa: 0 })) });
    const plan = planWeek(state);
    expect(plan.safe).toBe(true);
    expect(plan.actions).toEqual([{ kind: 'buy-hay', kg: 100 }]);
    expect(plan.metrics.money).toBeGreaterThan(0);
    const fed = experiment(5);
    const stopped = planWeek({ ...fed, animals: [], pasture: [], hayKg: 0, season: 'winter' });
    expect(stopped.actions).toEqual([]);
  });

  it('reports a genuine shortage when no safe plan exists', () => {
    const state = { ...experiment(0), money: 0, hayKg: 0 };
    const plan = planWeek(state);
    expect(plan.safe).toBe(false);
    expect(plan.feedGapKg).toBeCloseTo(feedRequirementKg(state.animals));
    expect(plan.explanation).toContain('未找到');
    expect(plan.expanded).toBe(0);
  });

  it('uses the current trial baseline rather than a historical asset denominator', () => {
    const state = experiment(1);
    const original = planWeek(state);
    const changedHistory = planWeek({ ...state, tracking: { ...state.tracking!, baseline: { ...state.tracking!.baseline, netAssets: 1 } } });
    expect(changedHistory.score).toBe(original.score);
    expect(changedHistory.actions).toEqual(original.actions);
  });

  it('finds a legal small top-up instead of bankrupting a 100 kg minimum purchase', () => {
    const sheep = createAnimal({ id: 'sheep-small', tag: 'S-001', species: 'sheep', sex: 'female', ageWeeks: 104, weightKg: 10 });
    const state = freeze({ ...experiment(1), animals: [sheep], pasture: [], season: 'winter' as const, money: 600, hayKg: 0 });
    expect(feedRequirementKg(state.animals)).toBeCloseTo(2.695);
    const plan = planWeek(state);
    expect(plan.actions).toEqual([{ kind: 'buy-hay', kg: 3 }]);
    expect(plan.safe).toBe(true);
    expect(plan.feedGapKg).toBe(0);
    expect(plan.metrics.money).toBe(43);
  });

  it('keeps an affordable partial-feed option with maintenance and cash reserved', () => {
    const yak = createAnimal({ id: 'yak-large', tag: 'B-001', species: 'yak', sex: 'female', ageWeeks: 208, weightKg: 520 });
    const state = freeze({ ...experiment(1), animals: [yak], pasture: [], season: 'winter' as const,
      labor: 0, money: 100.2, hayKg: 0 });
    const plan = planWeek(state);
    expect(plan.actions).toEqual([{ kind: 'buy-hay', kg: 28 }]);
    expect(plan.safe).toBe(false);
    expect(plan.feedCoverage).toBeGreaterThan(0);
    expect(plan.metrics.money).toBeCloseTo(3.2);
    expect(plan.metrics.money).toBeGreaterThanOrEqual(1);
    expect(plan.explanation).toContain('未找到');
  });
});

describe('policy comparison and recorded replay', () => {
  function shortOrigin(): RunState {
    const { tracking: _tracking, ...plain } = createRun(113);
    return ensureTracking({ ...plain, week: 12, season: 'winter' }, 'continued');
  }

  it('locks future policy outcomes until the actual run ends', () => {
    const state = freeze(shortOrigin());
    const comparison = comparePolicies(state);
    expect(comparison.available).toBe(false);
    expect(comparison.rows).toEqual([]);
  });

  it('uses the original baseline and does not alter the finished player record', () => {
    const origin = shortOrigin();
    const finished = freeze(simulatePolicy(origin, 'greedy').state);
    const before = JSON.stringify(finished);
    expect(restoreRunOrigin(finished).tracking!.baseline).toEqual(origin.tracking!.baseline);
    const comparison = comparePolicies(finished);
    expect(comparison.available).toBe(true);
    expect(comparison.fromWeek).toBe(12);
    expect(comparison.provenance).toBe('continued');
    expect(comparison.rows.map(row => row.id)).toEqual(['player', 'greedy', 'search']);
    expect(comparison.notes.join('')).toContain('两种自动策略');
    expect(comparison.notes.join('')).toContain('玩家保留真实选择');
    for (const row of comparison.rows) expect(row.assessment.baseline).toEqual(origin.tracking!.baseline);
    for (const row of comparison.rows) {
      expect(row.outcome.completed).toBe(true);
      expect(row.outcome.goalReached).toBe(row.assessment.eligible);
      expect(row.outcome.retainedShare).toBe(row.assessment.retainedShare);
      expect(row.outcome.retainedHalf).toBe(row.assessment.retainedShare >= 0.5);
    }
    expect(JSON.stringify(finished)).toBe(before);
  });

  it('refuses comparison across simulation versions without rewriting the record', () => {
    const state = simulatePolicy(shortOrigin(), 'greedy').state;
    const old = freeze({ ...state, tracking: { ...state.tracking!, version: 'previous-engine' } });
    const before = JSON.stringify(old);
    const comparison = comparePolicies(old);
    expect(comparison.available).toBe(false);
    expect(comparison.rows).toEqual([]);
    expect(comparison.reason).toContain('版本');
    expect(JSON.stringify(old)).toBe(before);
  });

  it('keeps an old finished v2 save as a current snapshot without inventing policy runs', () => {
    const finished = simulatePolicy(shortOrigin(), 'greedy').state;
    const { tracking: _tracking, ...legacy } = finished;
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ version: 2, data: { run: legacy } }) });
    let loaded: RunState;
    try {
      loaded = new SaveSystem().load()!.run;
    } finally {
      vi.unstubAllGlobals();
    }
    expect(loaded.ended).toBe(true);
    expect(captureMetrics(loaded)).toEqual(captureMetrics(finished));
    expect(loaded.tracking!.origin.ended).toBe(true);
    const before = JSON.stringify(freeze(loaded));
    const comparison = comparePolicies(loaded);
    expect(comparison.available).toBe(false);
    expect(comparison.rows).toEqual([]);
    expect(comparison.reason).toContain('历史起点');
    const exported = JSON.parse(exportRun(loaded));
    expect(exported.source.kind).toBe('snapshot');
    expect(exported.source.description).toContain('仅当前状态快照');
    expect(exported.source.description).toContain('不能重跑');
    expect(exported.weeks).toEqual([]);
    expect(captureMetrics(replayRun(exported))).toEqual(captureMetrics(finished));
    expect(JSON.stringify(loaded)).toBe(before);
  });

  it('accepts a real recorded final-week interval but refuses an empty history', () => {
    const { tracking: _tracking, ...plain } = createRun(31);
    const finalWeek = ensureTracking({ ...plain, week: 13, season: 'winter' });
    const finished = simulatePolicy(finalWeek, 'greedy').state;
    expect(comparePolicies(finished).available).toBe(true);
    const missingHistory = { ...finished, tracking: { ...finished.tracking!, weeks: [] } };
    expect(comparePolicies(missingHistory).available).toBe(false);
    expect(JSON.parse(exportRun(missingHistory)).source.kind).toBe('snapshot');
  });

  it('charges real scan installation and falls back to the same greedy baseline when unaffordable', () => {
    const origin = shortOrigin();
    const search = simulatePolicy(origin, 'search');
    expect(search.failure).toBeNull();
    expect(search.state.tracking!.weeks[0].decisions[0]).toEqual({ kind: 'action', action: { kind: 'tech', tech: 'scan' } });
    expect(search.state.tech.scanned).toBe(true);
    const poor = { ...origin, money: 0 };
    const fallback = simulatePolicy(poor, 'search');
    const greedy = simulatePolicy(poor, 'greedy');
    expect(fallback.state.tech.scanned).toBe(false);
    expect(captureMetrics(fallback.state)).toEqual(captureMetrics(greedy.state));
    expect(fallback.notes.join('')).toContain('贪心');
  });

  it('does not draw an extra event before the first playable week', () => {
    const run = simulatePolicy(shortOrigin(), 'greedy');
    expect(run.state.tracking!.weeks[0].decisions.every(d => d.kind === 'action')).toBe(true);
  });

  it('restores an actual pending event and selects the first affordable choice through the engine', () => {
    const source = shortOrigin();
    const { tracking: _tracking, ...plain } = source;
    const origin = ensureTracking({ ...plain, money: 0, flags: { 'pending-event:12:hay-shortage': true } });
    const run = simulatePolicy(origin, 'greedy');
    expect(run.failure).toBeNull();
    expect(run.state.tracking!.weeks[0].decisions[0]).toEqual({ kind: 'event', cardId: 'hay-shortage', choiceId: 'borrow' });
    expect(run.state.flags['pending-event:12:hay-shortage']).toBe(false);
    expect(captureMetrics(replayRun(exportRun(run.state)))).toEqual(captureMetrics(run.state));
  });

  it('never loops on rejected greedy actions', () => {
    const state = { ...experiment(5), money: 0, pasture: [], animals: [] };
    const result = playGreedyWeek(state);
    expect(result.state).toBe(state);
    expect(result.actions).toBe(0);
  });

  it('separates task achievement from finishing and preserves the actual baseline retention', () => {
    const origin = shortOrigin();
    expect(policyOutcome(origin).completed).toBe(false);
    expect(policyOutcome(origin).goalReached).toBe(false);
    const finished = simulatePolicy(origin, 'search').state;
    const ordinary = policyOutcome(finished);
    expect(ordinary.completed).toBe(true);
    expect(ordinary.retainedShare).toBe(captureMetrics(finished).sheepUnits / origin.tracking!.baseline.sheepUnits);
    expect(policyOutcome(finished, 'execution failed').completed).toBe(false);
    expect(policyOutcome(finished, 'execution failed').goalReached).toBe(false);
    const scarce = { ...finished, animals: finished.animals.map((animal, index) => ({ ...animal, alive: index === 0 })) };
    expect(policyOutcome(scarce).retainedHalf).toBe(false);
    expect(policyOutcome(scarce).goalReached).toBe(false);
  });

  it('exports flat actual records and replays them to the observed metrics', () => {
    const finished = simulatePolicy(shortOrigin(), 'greedy').state;
    const serialized = exportRun(finished);
    const exported = JSON.parse(serialized);
    expect(exported.source.provenance).toBe('continued');
    expect(exported.source.fromWeek).toBe(12);
    expect(exported.replayOrigin.tracking).toBeUndefined();
    expect(exported.scenario.configuration.tracking).toBeUndefined();
    expect(exported.weeks).toHaveLength(2);
    const replayed = replayRun(serialized);
    expect(captureMetrics(replayed)).toEqual(captureMetrics(finished));
    expect(replayed.tracking!.weeks).toEqual(finished.tracking!.weeks);
    expect(replayed.ending).toBe(finished.ending);
    exported.weeks[0].metrics.money += 1;
    expect(() => replayRun(exported)).toThrow('指标');
  });

  it('preserves the current unclosed week without adding a settlement', () => {
    const state = applyAction(shortOrigin(), { kind: 'cut-hay', cellId: 'P2' });
    const restored = replayRun(exportRun(state));
    expect(restored.week).toBe(12);
    expect(restored.tracking!.weeks).toEqual([]);
    expect(restored.tracking!.pending).toEqual(state.tracking!.pending);
    expect(captureMetrics(restored)).toEqual(captureMetrics(state));
  });
});
