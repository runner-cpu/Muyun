import { describe, expect, it } from 'vitest';
import { assessRun } from '../../src/sim/assessment';
import { captureMetrics, ensureTracking } from '../../src/sim/history';
import { createRun } from '../../src/sim/run';

describe('run assessment', () => {
  it('uses the documented equal-weight scores and recorded baseline', () => {
    const state = ensureTracking(createRun(71), 'new-run');
    const result = assessRun(state);
    expect(result.metrics).toEqual(captureMetrics(state));
    expect(result.baseline).toEqual(state.tracking!.baseline);
    expect(result.economy).toBeCloseTo(50);
    expect(result.ecology).toBeCloseTo(100);
    expect(result.health).toBeCloseTo(100);
    expect(result.overall).toBeCloseTo(250 / 3);
    expect(result.eligible).toBe(true);
  });

  it('maps a twenty percent net asset change to score limits', () => {
    const state = ensureTracking(createRun(71));
    const baseline = state.tracking!.baseline.netAssets;
    expect(assessRun({ ...state, money: state.money + baseline * 0.2 }).economy).toBeCloseTo(100);
    expect(assessRun({ ...state, money: state.money - baseline * 0.2 }).economy).toBeCloseTo(0);
    expect(assessRun({ ...state, money: state.money + baseline }).economy).toBe(100);
  });

  it('counts new births and known deaths without treating sales as mortality', () => {
    const state = ensureTracking(createRun(72));
    state.animals[0] = { ...state.animals[0], alive: false, exitReason: 'sold' };
    state.animals[1] = { ...state.animals[1], alive: false, exitReason: 'death' };
    state.animals.push({ ...state.animals[2], id: 'birth', tag: 'NEW', bcs: 3 });
    const result = assessRun(state);
    expect(result.births).toBe(1);
    expect(result.knownDeaths).toBe(1);
    expect(result.health).toBeCloseTo(70 + 30 * (1 - 1 / 51));
  });

  it('never awards the highest outcome after selling the herd', () => {
    const state = ensureTracking(createRun(73));
    state.money = 1000000;
    state.animals = state.animals.map(a => ({ ...a, alive: false, exitReason: 'sold' }));
    const result = assessRun(state);
    expect(result.economy).toBe(100);
    expect(result.health).toBe(0);
    expect(result.retainedShare).toBe(0);
    expect(result.knownDeaths).toBe(0);
    expect(result.eligible).toBe(false);
  });

  it('requires half the original sheep units and positive cash', () => {
    const state = ensureTracking(createRun(74));
    state.animals = state.animals.map((a, index) => ({ ...a, alive: index >= 20 }));
    state.money = 1000000;
    expect(assessRun(state).retainedShare).toBeCloseTo(30 / 130);
    expect(assessRun(state).eligible).toBe(false);
    expect(assessRun({ ...ensureTracking(createRun(75)), money: 0 }).eligible).toBe(false);
  });

  it('uses the current state for an untracked baseline and leaves its source unchanged', () => {
    const state = createRun(75);
    delete state.tracking;
    state.week = 8;
    state.animals[0] = { ...state.animals[0], alive: false, exitReason: 'death' };
    const before = JSON.stringify(state);
    const result = assessRun(state);
    expect(result.baseline).toEqual(captureMetrics(state));
    expect(result.economy).toBe(50);
    expect(result.knownDeaths).toBe(0);
    expect(result.births).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.tracking).toBeUndefined();
  });

  it('keeps all scores finite and bounded for an empty zero-asset baseline', () => {
    const state = createRun(76);
    state.animals = [];
    state.pasture = [];
    state.money = 0;
    state.hayKg = 0;
    const result = assessRun(state);
    for (const score of [result.economy, result.ecology, result.health, result.overall]) {
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
    expect(result.health).toBe(0);
    expect(result.eligible).toBe(false);
  });

  it('uses all three health weights and clamps grass recovery at its recorded baseline', () => {
    const state = ensureTracking(createRun(77));
    state.animals = state.animals.map((animal, index) => ({
      ...animal,
      bcs: 2,
      health: index % 2 === 0 ? 'healthy' : 'sick',
    }));
    state.pasture = state.pasture.map(cell => ({ ...cell, biomassKgPerHa: cell.biomassKgPerHa * 2, degradation: 0.2 }));
    const result = assessRun(state);
    expect(result.health).toBeCloseTo(20 + 15 + 30);
    expect(result.ecology).toBeCloseTo(70 * 0.8 + 30);
  });
});
