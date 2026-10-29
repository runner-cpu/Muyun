import type { Animal, PastureCell, Season } from './types';

const DEFAULT_AREA_HA = 2;
const DEFAULT_BIOMASS_KG_PER_HA = 900;
/** One sheep eats 1.75 kg dry matter a day, 12.25 kg a week. */
const WEEKLY_SHEEP_INTAKE_KG = 12.25;
/** Leave 40% standing biomass so the sward can recover. */
const GRAZE_TAKE_RATIO = 0.6;
/** Weekly demand above 30% of standing biomass starts to hurt the sward. */
const PRESSURE_FLOOR = 0.2;
const SUSTAINABLE_SHARE = 0.3;
const DEGRADATION_RATE = 0.045;

const PEAK_BIOMASS: Record<Season, number> = {
  spring: 900,
  summer: 1500,
  autumn: 1200,
  winter: 800,
};

const REGROWTH_RATE: Record<Season, number> = {
  spring: 0.18,
  summer: 0.25,
  autumn: 0.08,
  winter: 0.02,
};

export function createPastureCells(count = 4): PastureCell[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `P${index + 1}`,
    areaHa: DEFAULT_AREA_HA,
    biomassKgPerHa: DEFAULT_BIOMASS_KG_PER_HA,
    degradation: 0,
    restedWeeks: 0,
    grazing: false,
  }));
}

export function totalBiomassKg(cells: PastureCell[]): number {
  return cells.reduce((sum, cell) => sum + cell.biomassKgPerHa * cell.areaHa, 0);
}

export function sheepUnitEquivalent(animal: Animal): number {
  return animal.species === 'yak' ? 5 : 1;
}

/** Sheep units this cell can carry for one week. */
export function carryingCapacitySheepUnits(cell: PastureCell): number {
  const usable = cell.biomassKgPerHa * cell.areaHa * (1 - cell.degradation);
  return usable / WEEKLY_SHEEP_INTAKE_KG;
}

export function graze(
  cell: PastureCell,
  animals: Animal[],
): { cell: PastureCell; consumedKg: number } {
  const available = cell.biomassKgPerHa * cell.areaHa;
  const demand = animals.reduce(
    (sum, animal) => sum + sheepUnitEquivalent(animal) * WEEKLY_SHEEP_INTAKE_KG,
    0,
  );
  const consumedKg = Math.min(demand, available * GRAZE_TAKE_RATIO);
  const pressure = available > 0 ? demand / (available * SUSTAINABLE_SHARE) : 0;

  return {
    cell: {
      ...cell,
      biomassKgPerHa: Math.max(0, cell.biomassKgPerHa - consumedKg / cell.areaHa),
      degradation: clamp(
        cell.degradation + Math.max(0, pressure - PRESSURE_FLOOR) * DEGRADATION_RATE,
        0,
        1,
      ),
      grazing: true,
      restedWeeks: 0,
    },
    consumedKg,
  };
}

export function rest(cell: PastureCell, season: Season): PastureCell {
  const ceiling = PEAK_BIOMASS[season] * (1 - cell.degradation * 0.7);
  const growth = Math.max(0, ceiling - cell.biomassKgPerHa) * REGROWTH_RATE[season];
  const recovery = cell.restedWeeks >= 2 ? 0.01 : 0;

  return {
    ...cell,
    biomassKgPerHa: Math.max(0, cell.biomassKgPerHa + growth),
    degradation: clamp(cell.degradation - recovery, 0, 1),
    grazing: false,
    restedWeeks: cell.restedWeeks + 1,
  };
}

export function averageDegradation(cells: PastureCell[]): number {
  if (cells.length === 0) return 0;
  return cells.reduce((sum, cell) => sum + cell.degradation, 0) / cells.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
