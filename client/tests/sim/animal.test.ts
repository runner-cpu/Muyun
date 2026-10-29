import { describe, expect, it } from 'vitest';
import {
  applyWeeklyGrowth,
  bcsLabel,
  createAnimal,
  matureWeightKg,
  targetWeightKg,
} from '../../src/sim/animal';

describe('animal model', () => {
  it('creates a healthy adult with sane defaults', () => {
    const yak = createAnimal({ id: 'y1', tag: 'B-001', species: 'yak', sex: 'female', ageWeeks: 208 });
    expect(yak.health).toBe('healthy');
    expect(yak.alive).toBe(true);
    expect(yak.bcs).toBe(3);
    expect(yak.weightKg).toBeGreaterThan(100);
    expect(yak.pregnant).toBe(false);
  });

  it('orders mature weights by species and sex', () => {
    expect(matureWeightKg('yak', 'male')).toBeGreaterThan(matureWeightKg('yak', 'female'));
    expect(matureWeightKg('yak', 'female')).toBeGreaterThan(matureWeightKg('sheep', 'male'));
  });

  it('targets a smaller weight for a young animal', () => {
    const calf = createAnimal({ id: 'y2', tag: 'B-002', species: 'yak', sex: 'male', ageWeeks: 26 });
    const bull = createAnimal({ id: 'y3', tag: 'B-003', species: 'yak', sex: 'male', ageWeeks: 208 });
    expect(targetWeightKg(calf)).toBeLessThan(targetWeightKg(bull));
  });

  it('grows a well-fed young animal', () => {
    const calf = createAnimal({ id: 'y4', tag: 'B-004', species: 'yak', sex: 'male', ageWeeks: 52 });
    const fed = applyWeeklyGrowth(calf, 1.2);
    expect(fed.weightKg).toBeGreaterThan(calf.weightKg);
  });

  it('makes a starved adult lose weight and body condition', () => {
    const cow = createAnimal({ id: 'y5', tag: 'B-005', species: 'yak', sex: 'female', ageWeeks: 260 });
    const starved = applyWeeklyGrowth(cow, 0.5);
    expect(starved.weightKg).toBeLessThan(cow.weightKg);
    expect(starved.bcs).toBeLessThan(cow.bcs);
  });

  it('keeps body condition inside 1..5', () => {
    let thin = createAnimal({ id: 's1', tag: 'S-001', species: 'sheep', sex: 'female', ageWeeks: 90 });
    for (let i = 0; i < 40; i++) thin = applyWeeklyGrowth(thin, 0.1);
    expect(thin.bcs).toBe(1);

    let fat = createAnimal({ id: 's2', tag: 'S-002', species: 'sheep', sex: 'female', ageWeeks: 90 });
    for (let i = 0; i < 80; i++) fat = applyWeeklyGrowth(fat, 1.5);
    expect(fat.bcs).toBe(5);
  });

  it('labels body condition scores', () => {
    expect(bcsLabel(1.2)).toBe('瘦');
    expect(bcsLabel(2.2)).toBe('偏瘦');
    expect(bcsLabel(3)).toBe('标准');
    expect(bcsLabel(3.8)).toBe('偏肥');
    expect(bcsLabel(4.6)).toBe('肥');
  });
});
