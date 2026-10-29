import { describe, expect, it } from 'vitest';
import {
  applyAction,
  availableActions,
  createRun,
  endWeek,
  summarize,
} from '../../src/sim/run';
import { hayPricePerKg, techCost } from '../../src/sim/economy';
import { WEEKS_PER_RUN } from '../../src/sim/calendar';

describe('run state', () => {
  it('starts with a herd, pasture and three action points', () => {
    const state = createRun(1234);
    expect(state.week).toBe(1);
    expect(state.season).toBe('spring');
    expect(state.animals).toHaveLength(50);
    expect(state.pasture).toHaveLength(4);
    expect(state.actionsLeft).toBe(3);
    expect(state.money).toBeGreaterThan(0);
    expect(state.ended).toBe(false);
  });

  it('exposes the eight weekly actions', () => {
    const kinds = availableActions(createRun(1));
    expect(kinds).toContain('graze');
    expect(kinds).toContain('cut-hay');
    expect(kinds).toContain('breed');
    expect(kinds).toContain('vet');
    expect(kinds).toContain('sell');
    expect(kinds).toContain('buy-hay');
    expect(kinds).toContain('tech');
    expect(kinds).toContain('hire');
  });

  it('spends one action point per action', () => {
    const state = createRun(7);
    const next = applyAction(state, { kind: 'graze', cellId: 'P1' });
    expect(next.actionsLeft).toBe(2);
  });

  it('refuses actions when the week is spent', () => {
    let state = createRun(7);
    state = applyAction(state, { kind: 'graze', cellId: 'P1' });
    state = applyAction(state, { kind: 'graze', cellId: 'P1' });
    state = applyAction(state, { kind: 'graze', cellId: 'P1' });
    const blocked = applyAction(state, { kind: 'graze', cellId: 'P1' });
    expect(blocked.actionsLeft).toBe(0);
    expect(blocked.log).toHaveLength(state.log.length);
  });

  it('grazes biomass onto the week tally', () => {
    const state = createRun(7);
    const next = applyAction(state, { kind: 'graze', cellId: 'P1' });
    expect(next.grazedKg).toBeGreaterThan(0);
    const before = state.pasture.find((cell) => cell.id === 'P1')!.biomassKgPerHa;
    const after = next.pasture.find((cell) => cell.id === 'P1')!.biomassKgPerHa;
    expect(after).toBeLessThan(before);
  });

  it('cuts hay from a rested cell', () => {
    const state = createRun(7);
    const next = applyAction(state, { kind: 'cut-hay', cellId: 'P2' });
    expect(next.hayKg).toBeGreaterThan(state.hayKg);
  });

  it('sells animals for money', () => {
    const state = createRun(7);
    const target = state.animals[0].id;
    const next = applyAction(state, { kind: 'sell', animalIds: [target] });
    expect(next.money).toBeGreaterThan(state.money);
    expect(next.animals.find((a) => a.id === target)?.alive).toBe(false);
  });

  it('buys hay at the current price', () => {
    const state = createRun(7);
    const price = hayPricePerKg(state.season, false);
    const next = applyAction(state, { kind: 'buy-hay', kg: 100 });
    expect(next.hayKg).toBe(state.hayKg + 100);
    expect(next.money).toBe(state.money - Math.round(100 * price));
  });

  it('equips collars and books vaccination', () => {
    const state = createRun(7);
    const collared = applyAction(state, { kind: 'tech', tech: 'collar' });
    expect(collared.tech.collared).toBeGreaterThan(0);
    expect(collared.money).toBeLessThan(state.money);

    const vaccinated = applyAction(state, { kind: 'tech', tech: 'vaccine' });
    expect(vaccinated.tech.vaccinated).toBe(true);
    expect(vaccinated.money).toBe(state.money - techCost('vaccine', state.animals.length));
  });

  it('hires labour for a fixed fee', () => {
    const state = createRun(7);
    const next = applyAction(state, { kind: 'hire' });
    expect(next.labor).toBe(state.labor + 1);
    expect(next.money).toBe(state.money - 3000);
  });

  it('feeds the herd and advances the week', () => {
    const state = createRun(7);
    const next = endWeek(state);
    expect(next.week).toBe(2);
    expect(next.season).toBe('spring');
    expect(next.hayKg).toBeLessThan(state.hayKg);
    expect(next.actionsLeft).toBe(3);
    expect(next.grazedKg).toBe(0);
  });

  it('rests pasture cells that were not grazed', () => {
    const state = createRun(7);
    const grazed = applyAction(state, { kind: 'graze', cellId: 'P1' });
    const next = endWeek(grazed);
    expect(next.pasture.find((cell) => cell.id === 'P1')!.grazing).toBe(false);
    const restedCell = next.pasture.find((cell) => cell.id === 'P2')!;
    expect(restedCell.restedWeeks).toBeGreaterThan(0);
  });

  it('settles the run after the final week', () => {
    let state = createRun(7);
    for (let i = 0; i < WEEKS_PER_RUN; i++) state = endWeek(state);
    expect(state.ended).toBe(true);
    expect(state.ending).not.toBeNull();
    expect(state.week).toBe(WEEKS_PER_RUN);
  });

  it('replays identically for the same seed and actions', () => {
    const play = () => {
      let state = createRun(2024);
      state = applyAction(state, { kind: 'graze', cellId: 'P1' });
      state = applyAction(state, { kind: 'breed' });
      state = endWeek(state);
      state = applyAction(state, { kind: 'cut-hay', cellId: 'P2' });
      return endWeek(state);
    };
    expect(play()).toEqual(play());
  });

  it('summarises the herd', () => {
    const summary = summarize(createRun(7));
    expect(summary.herdSize).toBe(50);
    expect(summary.averageBcs).toBeGreaterThan(1);
    expect(summary.totalBiomassKg).toBeGreaterThan(0);
    expect(summary.ending).toBeNull();
  });

  it('scales the starting herd for stocking-rate experiments', () => {
    expect(createRun(7, { herdScale: 0.5 }).animals).toHaveLength(25);
    expect(createRun(7, { herdScale: 1.2 }).animals).toHaveLength(60);
    expect(createRun(7).animals).toHaveLength(50);
  });
});
