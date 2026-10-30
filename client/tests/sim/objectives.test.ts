import { describe, expect, it } from 'vitest';
import { seasonObjectives } from '../../src/sim/objectives';
import { captureMetrics, ensureTracking, recordDecision, recordWeek } from '../../src/sim/history';
import { applyAction, createRun, endWeek } from '../../src/sim/run';
import type { RunState, Season, WeekRecord } from '../../src/sim/types';

function weekly(state: RunState, week: number, season: Season, decisions: WeekRecord['decisions'] = []): WeekRecord {
  return { week, season, decisions, metrics: { ...captureMetrics(state), week }, collars: {} };
}

describe('season objectives', () => {
  it('shows real progress while keeping unclosed missions active', () => {
    let state = ensureTracking(createRun(91));
    state = recordDecision(state, { ...state, actionsLeft: 2 }, { kind: 'action', action: { kind: 'graze', cellId: 'P1' } });
    const before = JSON.stringify(state);
    const spring = seasonObjectives(state)[0];
    expect(spring.status).toBe('active');
    expect(spring.complete).toBe(false);
    expect(spring.current).toContain('1');
    expect(spring.current).toContain('0.00');
    expect(spring.description).toContain('还有 3 周');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('closes spring from distinct actual grazing decisions and its ending degradation', () => {
    const state = ensureTracking(createRun(92));
    state.week = 4;
    state.season = 'summer';
    state.tracking!.weeks = [
      weekly(state, 1, 'spring', [{ kind: 'action', action: { kind: 'graze', cellId: 'P1' } }]),
      weekly(state, 2, 'spring', [{ kind: 'action', action: { kind: 'graze', cellId: 'P2' } }]),
      weekly(state, 3, 'spring'),
    ];
    state.pasture = state.pasture.map(cell => ({ ...cell, degradation: 0.9 }));
    expect(seasonObjectives(state)[0]).toMatchObject({ complete: true, status: 'complete' });
    state.tracking!.weeks[1].decisions = [{ kind: 'action', action: { kind: 'graze', cellId: 'P1' } }];
    expect(seasonObjectives(state)[0]).toMatchObject({ complete: false, status: 'missed' });
  });

  it('reconstructs summer rest from recorded grazing and preserves the closed result', () => {
    let state = ensureTracking(createRun(93));
    const cells = state.pasture.map(cell => ({ ...cell, restedWeeks: 0 }));
    state = { ...state, week: 7, season: 'autumn', pasture: cells };
    state.tracking!.weeks = Array.from({ length: 6 }, (_, i) => weekly(state, i + 1, i < 3 ? 'spring' : 'summer', [
      { kind: 'action', action: { kind: 'graze', cellId: 'P1' } },
      { kind: 'action', action: { kind: 'cut-hay', cellId: 'P2' } },
    ]));
    expect(seasonObjectives(state)[1]).toMatchObject({ complete: true, status: 'complete' });
    state.tracking!.weeks[5].decisions = state.pasture.map(cell => ({ kind: 'action', action: { kind: 'graze', cellId: cell.id } }));
    expect(seasonObjectives(state)[1]).toMatchObject({ complete: false, status: 'missed' });
  });

  it('does not award summer recovery to cells harvested in each actual settled week', () => {
    let state = createRun(93);
    delete state.tracking;
    state = ensureTracking({ ...state, week: 4, season: 'summer', labor: 3, actionsLeft: 4 });
    for (let week = 4; week <= 6; week++) {
      for (const cell of state.pasture) state = applyAction(state, { kind: 'cut-hay', cellId: cell.id });
      state = endWeek(state);
    }
    expect(state.pasture.every(cell => cell.restedWeeks === 0)).toBe(true);
    expect(seasonObjectives(state)[1]).toMatchObject({ complete: false, status: 'missed' });
    expect(seasonObjectives(state)[1].current).toContain('≥2 周 0 区');
  });

  it('checks autumn against its recorded feed requirement and next upkeep', () => {
    const state = ensureTracking(createRun(94));
    state.week = 10;
    state.season = 'winter';
    const record = weekly(state, 9, 'autumn');
    record.metrics.hayKg = record.metrics.weeklyFeedKg * 2;
    record.metrics.money = record.metrics.weeklyCost;
    state.tracking!.weeks = [record];
    state.hayKg = 0;
    state.money = 0;
    expect(seasonObjectives(state)[2]).toMatchObject({ complete: true, status: 'complete' });
    record.metrics.money -= 1;
    expect(seasonObjectives(state)[2]).toMatchObject({ complete: false, status: 'missed' });
  });

  it('does not infer unrecorded spring grazing from later pasture conditions', () => {
    const state = createRun(98);
    state.week = 4;
    state.season = 'summer';
    state.tracking!.weeks = [weekly(state, 3, 'spring')];
    state.pasture = state.pasture.map(cell => ({ ...cell, restedWeeks: 3 }));
    expect(seasonObjectives(state)[0].status).toBe('unrecorded');
  });

  it('uses genuine rest counters at the start of a continued season', () => {
    let state = createRun(99);
    delete state.tracking;
    state.week = 5;
    state.season = 'summer';
    state.pasture = state.pasture.map(cell => ({ ...cell, restedWeeks: 0 }));
    state = ensureTracking(state, 'continued');
    state.tracking!.weeks = [weekly(state, 5, 'summer'), weekly(state, 6, 'summer')];
    state.week = 7;
    state.season = 'autumn';
    expect(seasonObjectives(state)[1].status).toBe('complete');
    expect(seasonObjectives(state)[0].status).toBe('unrecorded');
  });

  it('marks missing past seasons unrecorded without inventing records', () => {
    const state = createRun(95);
    delete state.tracking;
    state.week = 10;
    state.season = 'winter';
    const objectives = seasonObjectives(state);
    expect(objectives.slice(0, 3).map(item => item.status)).toEqual(['unrecorded', 'unrecorded', 'unrecorded']);
    expect(objectives[3].status).toBe('active');
    expect(objectives[3].current).toContain('3.0');
  });

  it('evaluates winter with original sheep units rather than animal count', () => {
    const state = ensureTracking(createRun(96));
    state.week = 13;
    state.season = 'winter';
    state.ended = true;
    const record = weekly(state, 13, 'winter');
    record.metrics.averageBcs = 2.5;
    record.metrics.sheepUnits = state.tracking!.baseline.sheepUnits * 0.5;
    record.metrics.money = 1;
    state.tracking!.weeks = [record];
    expect(seasonObjectives(state)[3]).toMatchObject({ complete: true, status: 'complete' });
    record.metrics.sheepUnits -= 1;
    expect(seasonObjectives(state)[3]).toMatchObject({ complete: false, status: 'missed' });
  });

  it('reads the final week record even though the calendar remains on week thirteen', () => {
    let state = ensureTracking(createRun(97));
    state = { ...state, week: 13, season: 'winter' };
    state = recordWeek(state, { ...state, ended: true });
    expect(seasonObjectives(state)[3].status).toBe('complete');
  });
});
