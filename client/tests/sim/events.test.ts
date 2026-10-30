import { describe, expect, it } from 'vitest';
import { drawEvent, EVENTS, eligibleCards } from '../../src/sim/events';
import { mulberry32 } from '../../src/sim/rng';

describe('event deck', () => {
  it('defines twelve cards', () => {
    expect(EVENTS).toHaveLength(12);
    expect(new Set(EVENTS.map((card) => card.id)).size).toBe(12);
  });

  it('gives every card two to four choices with unique ids, including a fallback', () => {
    for (const card of EVENTS) {
      expect(card.choices.length).toBeGreaterThanOrEqual(2);
      expect(card.choices.length).toBeLessThanOrEqual(4);
      expect(card.choices.some(choice => choice.id === 'defer')).toBe(true);
      const ids = card.choices.map((choice) => choice.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const choice of card.choices) {
        expect(choice.label.length).toBeGreaterThan(0);
        expect(choice.hint.length).toBeGreaterThan(0);
      }
    }
  });

  it('only offers a seasonal card in its own season', () => {
    const winterOnly = EVENTS.filter((card) => card.season === 'winter').map((card) => card.id);
    expect(winterOnly.length).toBeGreaterThan(0);
    const summer = eligibleCards('summer', []).map((card) => card.id);
    for (const id of winterOnly) expect(summer).not.toContain(id);
  });

  it('never repeats a card that was already used', () => {
    const first = eligibleCards('winter', [])[0];
    const next = eligibleCards('winter', [first.id]).map((card) => card.id);
    expect(next).not.toContain(first.id);
  });

  it('returns null when every card has been used', () => {
    const allIds = EVENTS.map((card) => card.id);
    expect(drawEvent('winter', allIds, mulberry32(1))).toBeNull();
  });

  it('is deterministic for the same seed', () => {
    const a = drawEvent('autumn', [], mulberry32(99));
    const b = drawEvent('autumn', [], mulberry32(99));
    expect(a?.id).toBe(b?.id);
  });

  it('uses finite numeric effects only', () => {
    for (const card of EVENTS) {
      for (const choice of card.choices) {
        for (const value of Object.values(choice.effect)) {
          if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});
