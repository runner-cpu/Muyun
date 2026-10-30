import { describe, expect, it } from 'vitest';
import { createAnimal } from '../../src/sim/animal';
import {
  averageDegradation,
  carryingCapacitySheepUnits,
  createPastureCells,
  graze,
  rest,
  sheepUnitEquivalent,
  totalBiomassKg,
} from '../../src/sim/pasture';

function yak() {
  return createAnimal({ id: 'y', tag: 'B-1', species: 'yak', sex: 'female', ageWeeks: 208 });
}

function sheep() {
  return createAnimal({ id: 's', tag: 'S-1', species: 'sheep', sex: 'female', ageWeeks: 90 });
}

describe('pasture', () => {
  it('creates fresh cells with biomass and no degradation', () => {
    const cells = createPastureCells(4);
    expect(cells).toHaveLength(4);
    expect(cells.every((cell) => cell.biomassKgPerHa > 0)).toBe(true);
    expect(cells.every((cell) => cell.degradation === 0)).toBe(true);
    expect(new Set(cells.map((cell) => cell.id)).size).toBe(4);
  });

  it('scales carrying capacity with biomass', () => {
    const [cell] = createPastureCells(1);
    const rich = { ...cell, biomassKgPerHa: 1800 };
    const poor = { ...cell, biomassKgPerHa: 600 };
    expect(carryingCapacitySheepUnits(rich)).toBeGreaterThan(carryingCapacitySheepUnits(poor));
  });

  it('counts one yak as five sheep units', () => {
    expect(sheepUnitEquivalent(yak())).toBe(5);
    expect(sheepUnitEquivalent(sheep())).toBe(1);
  });

  it('removes biomass while grazing and flags the cell', () => {
    const cell = createPastureCells(1)[0];
    const before = totalBiomassKg([cell]);
    const result = graze(cell, [yak(), yak()]);
    expect(result.consumedKg).toBeGreaterThan(0);
    expect(totalBiomassKg([result.cell])).toBeLessThan(before);
    expect(result.cell.grazing).toBe(true);
    expect(result.cell.restedWeeks).toBe(0);
  });

  it('never eats more than sixty percent of a cell', () => {
    const cell = createPastureCells(1)[0];
    const herd = Array.from({ length: 40 }, () => yak());
    const result = graze(cell, herd);
    const available = totalBiomassKg([cell]);
    expect(result.consumedKg).toBeLessThanOrEqual(available * 0.6 + 0.001);
    expect(totalBiomassKg([result.cell])).toBeGreaterThanOrEqual(available * 0.4 - 0.001);
  });

  it('degrades faster under heavy pressure', () => {
    const cell = createPastureCells(1)[0];
    const light = graze(cell, [sheep()]).cell;
    const heavy = graze(cell, Array.from({ length: 40 }, () => yak())).cell;
    expect(heavy.degradation).toBeGreaterThan(light.degradation);
  });

  it('regrows more in summer than in winter', () => {
    const base = { ...createPastureCells(1)[0], biomassKgPerHa: 300 };
    const summer = rest(base, 'summer');
    const winter = rest(base, 'winter');
    expect(summer.biomassKgPerHa).toBeGreaterThan(winter.biomassKgPerHa);
    expect(winter.biomassKgPerHa).toBeGreaterThanOrEqual(base.biomassKgPerHa);
    expect(summer.grazing).toBe(false);
    expect(summer.restedWeeks).toBe(1);
  });

  it('does not regrow or recover land already grazed or harvested this week', () => {
    for (const use of [{ grazing: true }, { harvested: true }]) {
      const cell = { ...createPastureCells(1)[0], biomassKgPerHa: 300, degradation: 0.2, restedWeeks: 3, ...use };
      const settled = rest(cell, 'summer');
      expect(settled.biomassKgPerHa).toBe(300);
      expect(settled.degradation).toBe(0.2);
      expect(settled.restedWeeks).toBe(0);
      expect(settled.grazing).toBe(false);
      expect(settled.harvested).toBe(false);
    }
  });

  it('averages degradation across cells', () => {
    const cells = createPastureCells(2);
    cells[0].degradation = 0.2;
    cells[1].degradation = 0.6;
    expect(averageDegradation(cells)).toBeCloseTo(0.4);
    expect(averageDegradation([])).toBe(0);
  });
});
