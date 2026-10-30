import { describe, expect, it } from 'vitest';
import { collarInsights, pastureInsights } from '../../src/sim/insights';
import { captureMetrics, ensureTracking, recordWeek } from '../../src/sim/history';
import { graze, rest } from '../../src/sim/pasture';
import { applyAction, createRun } from '../../src/sim/run';

describe('pasture insights', () => {
  it('shares the real grazing and resting formulas without changing its input', () => {
    const state = createRun(81);
    state.pasture[0] = { ...state.pasture[0], biomassKgPerHa: 350, restedWeeks: 3, degradation: 0.2 };
    state.animals[0] = { ...state.animals[0], alive: false };
    const before = JSON.stringify(state);
    const result = pastureInsights(state);
    expect(result).toHaveLength(4);
    for (const [index, insight] of result.entries()) {
      const grazing = graze(state.pasture[index], state.animals.filter(a => a.alive));
      const resting = rest(state.pasture[index], state.season);
      expect(insight).toEqual({
        cellId: state.pasture[index].id,
        canUse: true,
        reason: null,
        grazeKg: grazing.consumedKg,
        biomassAfterGrazing: grazing.cell.biomassKgPerHa,
        degradationAfterGrazing: grazing.cell.degradation,
        biomassAfterRest: resting.biomassKgPerHa,
        degradationAfterRest: resting.degradation,
      });
    }
    expect(JSON.stringify(state)).toBe(before);
    expect(pastureInsights(state)).toEqual(result);
  });

  it('shows settled current values instead of impossible second-use or rest alternatives', () => {
    const state = applyAction(createRun(86), { kind: 'cut-hay', cellId: 'P1' });
    const before = JSON.stringify(state);
    const cell = state.pasture[0];
    expect(pastureInsights(state)[0]).toMatchObject({
      canUse: false, reason: expect.stringContaining('已经使用'), grazeKg: 0,
      biomassAfterGrazing: cell.biomassKgPerHa, biomassAfterRest: cell.biomassKgPerHa,
      degradationAfterGrazing: cell.degradation, degradationAfterRest: cell.degradation,
    });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('collar insights', () => {
  it('includes only living collared animals and calls a first measurement unrecorded', () => {
    const state = createRun(82);
    state.animals[0] = { ...state.animals[0], collar: true, bcs: 2.2, health: 'sick' };
    state.animals[1] = { ...state.animals[1], collar: true, alive: false };
    const before = JSON.stringify(state);
    const result = collarInsights(state);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ animalId: state.animals[0].id, tag: state.animals[0].tag, bcs: 2.2, delta: null });
    expect(result[0].risk).toContain('偏瘦');
    expect(result[0].risk).toContain('患病');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('waits for a weekly settlement before showing an initial-collar trend', () => {
    let state = createRun(83);
    delete state.tracking;
    state.animals[0] = { ...state.animals[0], collar: true };
    state = ensureTracking(state);
    expect(collarInsights(state)[0].delta).toBeNull();
    const beforeBcs = state.animals[0].bcs;
    const after = { ...state, animals: state.animals.map((a, i) => i ? a : { ...a, bcs: beforeBcs - 0.2 }) };
    state = { ...recordWeek(state, after), week: 2 };
    expect(collarInsights(state)[0].delta).toBeCloseTo(-0.2);
  });

  it('does not borrow a non-collared baseline for a newly equipped animal', () => {
    let state = ensureTracking(createRun(84));
    state.animals = state.animals.map((a, i) => i ? a : { ...a, collar: true, bcs: 2.5 });
    state = { ...recordWeek(state, state), week: 2 };
    expect(collarInsights(state)[0].delta).toBeNull();
    const after = { ...state, animals: state.animals.map((a, i) => i ? a : { ...a, bcs: 2.7 }) };
    state = { ...recordWeek(state, after), week: 3 };
    expect(collarInsights(state)[0].delta).toBeCloseTo(0.2);
    expect(captureMetrics(state).week).toBe(3);
  });

  it('shows a current event change against the last real measurement', () => {
    let state = createRun(85);
    state.animals = state.animals.map((a, i) => i ? a : { ...a, collar: true, bcs: 2.5 });
    state = { ...recordWeek(state, state), week: 2 };
    state.animals = state.animals.map((a, i) => i ? a : { ...a, bcs: 2.6 });
    expect(collarInsights(state)[0].delta).toBeCloseTo(0.1);
  });
});
