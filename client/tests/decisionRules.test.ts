import { describe, expect, it } from 'vitest';
import { applyAction, createRun, endWeek, resolveEvent } from '../src/sim/run';
import { actionLimit, actionStatus, eventChoiceStatus, pastureUse, visibleEventChoices } from '../src/sim/rules';
import { settleBirths } from '../src/sim/reproduction';
import { mulberry32 } from '../src/sim/rng';
import { captureMetrics } from '../src/sim/history';
import { settleDeterministic } from '../src/sim/settlement';
import { EVENTS } from '../src/sim/events';

describe('authoritative decision rules', () => {
  it('always offers a legal fallback even without money, hay or herd', () => {
    for (const card of EVENTS) {
      const s = { ...createRun(7), season: card.season ?? 'spring' as const, money: 0, hayKg: 0, animals: [] };
      expect(card.choices.some(choice => !eventChoiceStatus(s, card.id, choice.id).reason)).toBe(true);
      const legal = visibleEventChoices(s, card).filter(choice => !eventChoiceStatus(s, card.id, choice.id).reason);
      expect(legal.length).toBeGreaterThan(0);
      expect(resolveEvent(s, card.id, legal[0].id)).not.toBe(s);
    }
  });
  it('forbids the fallback while any original event response remains legal', () => {
    const state = { ...createRun(7), money: 0 };
    const drought = EVENTS.find(card => card.id === 'drought')!;
    const summer = { ...state, season: 'summer' as const };
    expect(eventChoiceStatus(summer, drought.id, 'defer').reason).toContain('常规');
    expect(resolveEvent(summer, drought.id, 'defer')).toBe(summer);
    expect(visibleEventChoices(summer, drought).map(choice => choice.id)).toEqual(['cut-early', 'reduce', 'well']);
    const vet = EVENTS.find(card => card.id === 'vet-visit')!;
    expect(visibleEventChoices(state, vet).some(choice => choice.id === 'defer')).toBe(true);
    const next = resolveEvent(state, vet.id, 'defer');
    expect(next.animals[0].bcs).toBeCloseTo(state.animals[0].bcs - 0.2);
    expect(next.pasture[0].degradation).toBeCloseTo(state.pasture[0].degradation + 0.02);
  });
  it('enforces one grazing or hay harvest per cell per week without spending a refused action', () => {
    for (const first of ['graze', 'cut-hay'] as const) {
      const state = applyAction(createRun(7), { kind: first, cellId: 'P1' });
      const before = JSON.stringify(state);
      for (const second of ['graze', 'cut-hay'] as const) {
        expect(actionStatus(state, { kind: second, cellId: 'P1' }).reason).toContain('本周已经使用');
        expect(applyAction(state, { kind: second, cellId: 'P1' })).toBe(state);
      }
      expect(JSON.stringify(state)).toBe(before);
      const nextWeek = endWeek(state);
      expect(pastureUse(nextWeek, nextWeek.pasture[0])).toBe('resting');
      expect(actionStatus(nextWeek, { kind: 'cut-hay', cellId: 'P1' }).reason).toBeNull();
    }
  });
  it('uses recorded current-week use when a legacy physical flag is absent', () => {
    const state = applyAction(createRun(7), { kind: 'cut-hay', cellId: 'P1' });
    state.pasture = state.pasture.map(cell => ({ ...cell, harvested: false }));
    expect(pastureUse(state, state.pasture[0])).toBe('cut');
    expect(actionStatus(state, { kind: 'graze', cellId: 'P1' }).reason).toContain('已经使用');
    const settled = settleDeterministic(state);
    expect(settled.pasture[0].biomassKgPerHa).toBe(state.pasture[0].biomassKgPerHa);
    expect(settled.pasture[0].restedWeeks).toBe(0);
  });
  it('harvesting interrupts continuous rest and only unused cells recover at settlement', () => {
    const origin = createRun(8);
    origin.pasture = origin.pasture.map(cell => ({ ...cell, restedWeeks: 3, biomassKgPerHa: 300, degradation: 0.2 }));
    const cut = applyAction(origin, { kind: 'cut-hay', cellId: 'P1' });
    expect(cut.pasture[0]).toMatchObject({ restedWeeks: 0, harvested: true });
    const settled = settleDeterministic(cut);
    expect(settled.pasture[0]).toMatchObject({ restedWeeks: 0, harvested: false, grazing: false, degradation: 0.2, biomassKgPerHa: 270 });
    expect(settled.pasture[1].restedWeeks).toBe(4);
    expect(settled.pasture[1].degradation).toBeCloseTo(0.19);
    expect(settled.pasture[1].biomassKgPerHa).toBeGreaterThan(300);
  });
  it('hire costs an action now and provides additional capacity next week', () => {
    const s = createRun(7);
    const hired = applyAction(s, { kind: 'hire' });
    expect(hired.actionsLeft).toBe(2);
    expect(actionLimit(hired)).toBe(4);
    expect(endWeek(hired).actionsLeft).toBe(4);
    expect(actionStatus({ ...hired, labor: 4 }, { kind: 'hire' }).reason).toBeTruthy();
  });
  it('rejects repeat services and records only real actions', () => {
    const s = applyAction(createRun(4), { kind: 'tech', tech: 'scan' });
    expect(applyAction(s, { kind: 'tech', tech: 'scan' })).toBe(s);
    expect(s.tracking?.pending).toHaveLength(1);
    expect(s.tracking?.pending[0]).toEqual({ kind: 'action', action: { kind: 'tech', tech: 'scan' } });
  });
  it('rejects unaffordable and repeated events without modifying flags', () => {
    const s = { ...createRun(5), money: 0 };
    expect(eventChoiceStatus(s, 'vet-visit', 'full').reason).toBeTruthy();
    expect(resolveEvent(s, 'vet-visit', 'full')).toBe(s);
    const paid = { ...s, money: 1000 };
    const next = resolveEvent(paid, 'vet-visit', 'full');
    expect(paid.flags.checked).toBeUndefined();
    expect(next.flags.checked).toBe(true);
    expect(resolveEvent(next, 'vet-visit', 'full')).toBe(next);
  });
  it('sale and death are distinguishable and departed mothers cannot calve', () => {
    const s = createRun(1);
    const mother = { ...s.animals[0], pregnant: true };
    const sold = applyAction({ ...s, animals: [mother] }, { kind: 'sell', animalIds: [mother.id] });
    expect(sold.animals[0].exitReason).toBe('sold');
    expect(captureMetrics(sold).deaths).toBe(0);
    const births = settleBirths(sold.animals, mulberry32(1));
    expect(births.born).toBe(0);
    expect(births.animals[0].lactating).toBe(false);
  });
  it('forecast shares deterministic settlement and does not change source or calendar', () => {
    const s = createRun(2);
    const original = JSON.stringify(s);
    const projected = settleDeterministic(s);
    expect(JSON.stringify(s)).toBe(original);
    expect(projected.week).toBe(s.week);
    expect(projected.weather).toBe(s.weather);
    expect(projected.money).toBe(s.money - captureMetrics(s).weeklyCost);
  });
  it('maintains one record for each settled week and opening events belong to next week', () => {
    let s = applyAction(createRun(3), { kind: 'graze', cellId: 'P1' });
    s = endWeek(s);
    expect(s.tracking?.weeks[0].week).toBe(1);
    expect(s.tracking?.weeks[0].decisions).toHaveLength(1);
    expect(s.tracking?.pending).toHaveLength(0);
    s = resolveEvent(s, 'neighbour', 'refuse');
    expect(s.tracking?.weeks).toHaveLength(1);
    expect(s.tracking?.pending).toHaveLength(1);
    s = endWeek(s);
    expect(s.tracking?.weeks[1].week).toBe(2);
    expect(s.tracking?.weeks[1].decisions[0].kind).toBe('event');
  });
});
