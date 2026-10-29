import { describe, expect, it } from 'vitest';
import { createAnimal } from '../../src/sim/animal';
import {
  dryMatterIntakeKg,
  feedRatio,
  feedRequirementKg,
  herdIntakeKg,
} from '../../src/sim/nutrition';

function yak(weightKg: number) {
  const animal = createAnimal({ id: `y${weightKg}`, tag: 'B-100', species: 'yak', sex: 'female', ageWeeks: 208 });
  return { ...animal, weightKg };
}

function sheep(weightKg: number) {
  const animal = createAnimal({ id: `s${weightKg}`, tag: 'S-100', species: 'sheep', sex: 'female', ageWeeks: 90 });
  return { ...animal, weightKg };
}

describe('nutrition', () => {
  it('uses 2.5% of body weight per day for yaks', () => {
    expect(dryMatterIntakeKg(yak(200))).toBeCloseTo(5);
  });

  it('uses 3.5% of body weight per day for sheep', () => {
    expect(dryMatterIntakeKg(sheep(50))).toBeCloseTo(1.75);
  });

  it('sums a week of intake across the herd', () => {
    expect(herdIntakeKg([yak(200), sheep(50)])).toBeCloseTo(47.25);
  });

  it('adds ten percent waste to the weekly requirement', () => {
    expect(feedRequirementKg([yak(200), sheep(50)])).toBeCloseTo(51.975);
  });

  it('reports a feed ratio between 0 and the cap', () => {
    expect(feedRatio(0, 100)).toBe(0);
    expect(feedRatio(50, 100)).toBe(0.5);
    expect(feedRatio(100, 100)).toBe(1);
    expect(feedRatio(1000, 100)).toBe(1.5);
  });

  it('handles an empty herd without dividing by zero', () => {
    expect(feedRequirementKg([])).toBe(0);
    expect(feedRatio(100, 0)).toBe(1.5);
  });
});
