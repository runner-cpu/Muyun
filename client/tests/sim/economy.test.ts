import { describe, expect, it } from 'vitest';
import { createAnimal } from '../../src/sim/animal';
import {
  animalPrice,
  buyHay,
  evaluateEnding,
  hayPricePerKg,
  sellAnimals,
  techCost,
  weeklyCosts,
} from '../../src/sim/economy';

function yak(weightKg: number, bcs = 3) {
  const animal = createAnimal({ id: 'y', tag: 'B-1', species: 'yak', sex: 'male', ageWeeks: 208 });
  return { ...animal, weightKg, bcs };
}

describe('economy', () => {
  it('pays more in autumn than in spring', () => {
    expect(animalPrice(yak(300), 'autumn')).toBeGreaterThan(animalPrice(yak(300), 'spring'));
  });

  it('pays more for a heavier animal', () => {
    expect(animalPrice(yak(380), 'autumn')).toBeGreaterThan(animalPrice(yak(260), 'autumn'));
  });

  it('pays less for an animal in poor condition', () => {
    expect(animalPrice(yak(300, 1.8), 'autumn')).toBeLessThan(animalPrice(yak(300, 4), 'autumn'));
  });

  it('doubles hay price during a blizzard', () => {
    const normal = hayPricePerKg('winter', false);
    expect(hayPricePerKg('winter', true)).toBeCloseTo(normal * 2);
  });

  it('charges more hay in winter than in summer', () => {
    expect(hayPricePerKg('winter', false)).toBeGreaterThan(hayPricePerKg('summer', false));
  });

  it('pays weekly labour and technology upkeep', () => {
    expect(weeklyCosts(3, { collared: 20, vaccinated: true, scanned: false })).toBeGreaterThan(
      weeklyCosts(1, { collared: 0, vaccinated: false, scanned: false }),
    );
  });

  it('sells animals and returns revenue', () => {
    const herd = [yak(300), { ...yak(300), id: 'y2', tag: 'B-2' }];
    const result = sellAnimals(herd, ['y'], 'autumn');
    expect(result.sold).toBe(1);
    expect(result.revenue).toBeGreaterThan(0);
    expect(result.animals.find((a) => a.id === 'y')?.alive).toBe(false);
    expect(result.animals.filter((a) => a.alive)).toHaveLength(1);
  });

  it('refuses to buy hay without enough money', () => {
    const poor = buyHay(100, 0, 100, 2);
    expect(poor.ok).toBe(false);
    expect(poor.money).toBe(100);
    expect(poor.hayKg).toBe(0);

    const rich = buyHay(1000, 0, 100, 2);
    expect(rich.ok).toBe(true);
    expect(rich.money).toBe(800);
    expect(rich.hayKg).toBe(100);
  });

  it('scales hardware cost with head count', () => {
    expect(techCost('collar', 10)).toBeGreaterThan(techCost('collar', 1));
    expect(techCost('vaccine', 10)).toBeGreaterThan(0);
    expect(techCost('scan', 10)).toBeGreaterThan(0);
  });

  it('awards the five endings', () => {
    expect(evaluateEnding({ money: 0, reputation: 80, averageDegradation: 0.1 })).toBe('bankrupt');
    expect(evaluateEnding({ money: 9000, reputation: 20, averageDegradation: 0.8 })).toBe('collapse');
    expect(evaluateEnding({ money: 70000, reputation: 80, averageDegradation: 0.2 })).toBe('cooperative');
    expect(evaluateEnding({ money: 30000, reputation: 40, averageDegradation: 0.2 })).toBe('well-off');
    expect(evaluateEnding({ money: 9000, reputation: 40, averageDegradation: 0.2 })).toBe('subsistence');
  });
});
