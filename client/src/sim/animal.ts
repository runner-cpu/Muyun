import type { Animal, Sex, Species } from './types';

const MATURE_WEIGHT: Record<Species, Record<Sex, number>> = {
  yak: { male: 420, female: 300 },
  sheep: { male: 70, female: 55 },
};

/** Age at which growth plateaus, in weeks. */
const MATURITY_WEEKS: Record<Species, number> = { yak: 208, sheep: 78 };

const BIRTH_RATIO = 0.07;

export interface CreateAnimalInput {
  id: string;
  tag: string;
  species: Species;
  sex: Sex;
  ageWeeks: number;
  weightKg?: number;
}

export function matureWeightKg(species: Species, sex: Sex): number {
  return MATURE_WEIGHT[species][sex];
}

/** Gompertz-shaped target weight for the animal's current age. */
export function targetWeightKg(animal: Pick<Animal, 'species' | 'sex' | 'ageWeeks'>): number {
  const mature = matureWeightKg(animal.species, animal.sex);
  const birth = mature * BIRTH_RATIO;
  const t = Math.min(1, Math.max(0, animal.ageWeeks / MATURITY_WEEKS[animal.species]));
  const curve = (1 - Math.exp(-3 * t)) / (1 - Math.exp(-3));
  return birth + (mature - birth) * curve;
}

export function createAnimal(input: CreateAnimalInput): Animal {
  const base: Animal = {
    id: input.id,
    tag: input.tag,
    species: input.species,
    sex: input.sex,
    ageWeeks: input.ageWeeks,
    weightKg: 0,
    bcs: 3,
    health: 'healthy',
    pregnant: false,
    lactating: false,
    collar: false,
    alive: true,
  };
  return { ...base, weightKg: input.weightKg ?? Math.round(targetWeightKg(base)) };
}

/**
 * One week of condition change. `feedRatio` is actual intake over requirement:
 * 1.0 = maintenance, >1.1 = gaining condition, <0.95 = losing it.
 */
export function applyWeeklyGrowth(animal: Animal, feedRatio: number): Animal {
  if (!animal.alive) return animal;

  const target = targetWeightKg(animal);
  const gainCap = animal.species === 'yak' ? 1.5 : 0.4;
  const lossCap = animal.species === 'yak' ? 2.0 : 0.5;

  let weight = animal.weightKg;
  let bcs = animal.bcs;

  if (feedRatio >= 0.95) {
    const headroom = Math.max(0, target - weight);
    const appetite = Math.min(1, (feedRatio - 0.9) / 0.3);
    weight += Math.min(headroom, gainCap * Math.min(1.4, feedRatio) * appetite);
    if (feedRatio > 1.1) bcs += 0.05;
  } else {
    const severity = (0.95 - feedRatio) / 0.95;
    weight -= lossCap * severity;
    bcs -= 0.2 * severity;
  }

  return {
    ...animal,
    weightKg: Math.max(10, round1(weight)),
    bcs: clamp(Math.round(bcs * 100) / 100, 1, 5),
  };
}

export function bcsLabel(bcs: number): string {
  if (bcs <= 1.5) return '瘦';
  if (bcs <= 2.5) return '偏瘦';
  if (bcs <= 3.5) return '标准';
  if (bcs <= 4.25) return '偏肥';
  return '肥';
}

export function isAdult(animal: Animal): boolean {
  return animal.ageWeeks >= MATURITY_WEEKS[animal.species] * 0.5;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
