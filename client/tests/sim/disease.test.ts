import { describe, expect, it } from 'vitest';
import { createAnimal } from '../../src/sim/animal';
import { outbreakChance, progressWeek, sickCount } from '../../src/sim/disease';

const alwaysZero = () => 0;
const rngAt = (value: number) => () => value;

function sickYak(id: string) {
  return { ...createAnimal({ id, tag: `B-${id}`, species: 'yak' as const, sex: 'female' as const, ageWeeks: 208 }), health: 'sick' as const };
}

function healthyYak(id: string) {
  return createAnimal({ id, tag: `B-${id}`, species: 'yak', sex: 'female', ageWeeks: 208 });
}

describe('disease', () => {
  it('raises outbreak risk with herd size', () => {
    expect(outbreakChance(10, 'summer', false)).toBeLessThan(outbreakChance(120, 'summer', false));
  });

  it('makes winter riskier than summer', () => {
    expect(outbreakChance(40, 'winter', false)).toBeGreaterThan(outbreakChance(40, 'summer', false));
  });

  it('lowers risk when the herd is vaccinated', () => {
    expect(outbreakChance(40, 'winter', true)).toBeLessThan(outbreakChance(40, 'winter', false));
  });

  it('caps outbreak risk below certainty', () => {
    expect(outbreakChance(10000, 'winter', false)).toBeLessThanOrEqual(0.6);
  });

  it('does nothing when no animal is sick', () => {
    const result = progressWeek([healthyYak('a'), healthyYak('b')], rngAt(0.5), false);
    expect(result.deaths).toBe(0);
    expect(result.newlySick).toBe(0);
    expect(sickCount(result.animals)).toBe(0);
  });

  it('spreads infection to a healthy neighbour', () => {
    const herd = [sickYak('s'), healthyYak('h1'), healthyYak('h2'), healthyYak('h3')];
    const result = progressWeek(herd, rngAt(0.15), false);
    expect(result.newlySick).toBe(1);
    expect(sickCount(result.animals)).toBe(1);
  });

  it('kills fewer animals when the herd is treated', () => {
    const herd = [sickYak('s'), healthyYak('h')];
    const untreated = progressWeek(herd, rngAt(0.07), false);
    const treated = progressWeek(herd, rngAt(0.07), true);
    expect(treated.deaths).toBeLessThan(untreated.deaths);
    expect(treated.deaths).toBe(0);
  });

  it('reports the number of sick animals', () => {
    expect(sickCount([sickYak('a'), healthyYak('b'), { ...sickYak('c'), alive: false }])).toBe(1);
  });

  it('is deterministic for the same roll', () => {
    const herd = [sickYak('s'), healthyYak('h1'), healthyYak('h2')];
    const first = progressWeek(herd, alwaysZero, false);
    const second = progressWeek(herd, alwaysZero, false);
    expect(first.animals.map((a) => a.alive)).toEqual(second.animals.map((a) => a.alive));
  });
});
