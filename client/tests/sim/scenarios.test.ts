import { describe, expect, it } from 'vitest';
import { createWinterChallenge } from '../../src/sim/scenarios';
import { captureMetrics } from '../../src/sim/history';
import { collarInsights } from '../../src/sim/insights';
import { seasonObjectives } from '../../src/sim/objectives';
import { endWeek } from '../../src/sim/run';
import { weeklyCosts } from '../../src/sim/economy';

describe('fixed winter challenge', () => {
  it('starts from the stated deterministic setup and captures its actual baseline', () => {
    const state = createWinterChallenge();
    expect(state).toEqual(createWinterChallenge());
    expect(state.scenario).toBe('winter-challenge-v1');
    expect(state.seed).toBe(20261030);
    expect(state.week).toBe(10);
    expect(state.season).toBe('winter');
    expect(state.money).toBe(6000);
    expect(state.hayKg).toBe(2200);
    expect(state.animals.filter(a => a.species === 'yak')).toHaveLength(12);
    expect(state.animals.filter(a => a.species === 'sheep')).toHaveLength(18);
    expect(state.pasture.map(cell => cell.biomassKgPerHa)).toEqual([700, 560, 420, 320]);
    expect(state.pasture.map(cell => cell.degradation)).toEqual([0.1, 0.18, 0.25, 0.32]);
    expect(state.tech).toEqual({ collared: 10, vaccinated: false, scanned: true });
    expect(state.animals.filter(a => a.alive && a.collar)).toHaveLength(10);
    expect(state.tracking!.baseline).toEqual(captureMetrics(state));
    expect(state.tracking!.origin.week).toBe(10);
    expect(state.tracking!.weeks).toEqual([]);
    expect(state.tracking!.pending).toEqual([]);
    expect(state.tracking!.provenance).toBe('new-run');
    expect(collarInsights(state).every(item => item.delta === null)).toBe(true);
    expect(seasonObjectives(state).map(item => item.season)).toEqual(['winter']);
  });

  it('ends after exactly four settlements and charges installed equipment every week', () => {
    let state = createWinterChallenge();
    let expectedMoney = 6000;
    for (let settlement = 0; settlement < 4; settlement++) {
      const actualCollars = state.animals.filter(a => a.alive && a.collar).length;
      expectedMoney -= weeklyCosts(state.labor, { ...state.tech, collared: actualCollars });
      state = endWeek(state);
      expect(state.money).toBe(expectedMoney);
      expect(state.ended).toBe(settlement === 3);
    }
    expect(state.tracking!.weeks.map(record => record.week)).toEqual([10, 11, 12, 13]);
    expect(state.week).toBe(13);
    expect(endWeek(state)).toBe(state);
  });

  it('returns independent state trees for retries', () => {
    const first = createWinterChallenge();
    const second = createWinterChallenge();
    first.animals[0].bcs = 1;
    first.pasture[0].biomassKgPerHa = 0;
    first.tracking!.origin.animals[0].bcs = 1;
    expect(second.animals[0].bcs).toBe(3);
    expect(second.pasture[0].biomassKgPerHa).toBe(700);
    expect(second.tracking!.origin.animals[0].bcs).toBe(3);
  });
});
