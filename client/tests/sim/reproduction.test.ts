import { describe, expect, it } from 'vitest';
import { createAnimal } from '../../src/sim/animal';
import {
  breedHerd,
  conceptionChance,
  isBreedingEligible,
  settleBirths,
} from '../../src/sim/reproduction';

const alwaysSucceed = () => 0;
const alwaysFail = () => 0.999999;

function cow(bcs: number, ageWeeks = 208) {
  return { ...createAnimal({ id: 'c1', tag: 'B-001', species: 'yak', sex: 'female', ageWeeks }), bcs };
}

describe('reproduction', () => {
  it('rejects a female below the body condition threshold', () => {
    expect(isBreedingEligible(cow(2.4))).toBe(false);
  });

  it('accepts a well-conditioned adult female', () => {
    expect(isBreedingEligible(cow(3.5))).toBe(true);
  });

  it('rejects pregnant, male and immature animals', () => {
    expect(isBreedingEligible({ ...cow(3.5), pregnant: true })).toBe(false);
    expect(isBreedingEligible({ ...cow(3.5), sex: 'male' })).toBe(false);
    expect(isBreedingEligible(cow(3.5, 40))).toBe(false);
  });

  it('raises conception chance with body condition', () => {
    expect(conceptionChance(cow(2.6))).toBeLessThan(conceptionChance(cow(3.6)));
    expect(conceptionChance(cow(5))).toBeLessThanOrEqual(0.9);
  });

  it('marks eligible females pregnant when the roll succeeds', () => {
    const herd = [cow(3.5), cow(3.5), cow(2.0)];
    const result = breedHerd(herd, alwaysSucceed);
    expect(result.conceived).toBe(2);
    expect(result.animals.filter((a) => a.pregnant)).toHaveLength(2);
  });

  it('conceives nothing when the roll fails', () => {
    const result = breedHerd([cow(3.5)], alwaysFail);
    expect(result.conceived).toBe(0);
    expect(result.animals[0].pregnant).toBe(false);
  });

  it('settles births for pregnant females and clears the flag', () => {
    const herd = [cow(3.5), { ...cow(3.5), id: 'c2', pregnant: true }, { ...cow(3.5), id: 'c3', pregnant: true }];
    const result = settleBirths(herd, alwaysSucceed);
    expect(result.born).toBe(2);
    expect(result.animals.filter((a) => a.alive)).toHaveLength(5);
    expect(result.animals.filter((a) => a.pregnant)).toHaveLength(0);
    const calves = result.animals.slice(3);
    expect(calves.every((a) => a.ageWeeks === 0)).toBe(true);
    expect(calves.every((a) => a.weightKg < 40)).toBe(true);
  });
});
