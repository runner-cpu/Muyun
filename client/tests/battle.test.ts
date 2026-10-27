import { describe, expect, it } from 'vitest';
import { calcDamage, createBattle, resolveTurn, typeMultiplier, makeBattlePet } from '../src/minigames/battle';

const fixed = (value: number) => () => value;

describe('type chart', () => {
  it('uses the orange → black → white → orange loop', () => {
    expect(typeMultiplier('orange', 'black')).toBe(1.5);
    expect(typeMultiplier('black', 'white')).toBe(1.5);
    expect(typeMultiplier('white', 'orange')).toBe(1.5);
    expect(typeMultiplier('black', 'orange')).toBe(0.75);
    expect(typeMultiplier('white', 'black')).toBe(0.75);
    expect(typeMultiplier('orange', 'white')).toBe(0.75);
    expect(typeMultiplier('black', 'black')).toBe(1);
  });
});

describe('damage', () => {
  it('is deterministic with a fixed rng and at least 1', () => {
    const attacker = makeBattlePet('orange');
    const defender = makeBattlePet('black');
    const skill = { id: 'x', name: 'x', type: 'orange' as const, power: 10, description: '' };
    expect(calcDamage(attacker, defender, skill, fixed(0))).toBe(11);
    expect(calcDamage({ ...attacker, attack: 0 }, { ...defender, defense: 99 }, skill, fixed(0.85))).toBe(1);
  });
});

describe('turn resolution', () => {
  it('faster pet acts first', () => {
    const state = createBattle('black', 'white');
    const events = resolveTurn(state, 'shadow_claw', fixed(0.9));
    expect(events[0].actor).toBe('player');
    expect(state.turn).toBe(2);
  });

  it('ends with a win when the enemy reaches zero hp', () => {
    const state = createBattle('black', 'white');
    state.enemy.currentHp = 1;
    const events = resolveTurn(state, 'night_dash', fixed(0.9));
    expect(events.length).toBeGreaterThan(0);
    expect(state.over).toBe(true);
    expect(state.win).toBe(true);
    expect(state.enemy.currentHp).toBe(0);
  });

  it('ignores skills that the pet does not know', () => {
    const state = createBattle('black', 'white');
    const before = state.enemy.currentHp;
    expect(resolveTurn(state, 'ice_tail')).toEqual([]);
    expect(state.enemy.currentHp).toBe(before);
  });
});
