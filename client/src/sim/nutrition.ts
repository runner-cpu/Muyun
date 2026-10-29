import type { Animal, Species } from './types';

/** Dry matter intake as a fraction of body weight. */
const INTAKE_RATE: Record<Species, number> = { yak: 0.025, sheep: 0.035 };

/** Hay is bought and fed as dry matter, with 10% trampling and storage loss. */
const WASTE_FACTOR = 1.1;
const DAYS_PER_WEEK = 7;
const MAX_RATIO = 1.5;

/** Daily dry matter intake in kg. */
export function dryMatterIntakeKg(animal: Animal): number {
  if (!animal.alive) return 0;
  return animal.weightKg * INTAKE_RATE[animal.species];
}

/** Weekly dry matter intake for the whole herd, in kg. */
export function herdIntakeKg(animals: Animal[]): number {
  return animals.reduce((sum, animal) => sum + dryMatterIntakeKg(animal) * DAYS_PER_WEEK, 0);
}

export function feedRequirementKg(animals: Animal[]): number {
  return herdIntakeKg(animals) * WASTE_FACTOR;
}

/** Available feed over requirement, clamped to 0..1.5. */
export function feedRatio(availableKg: number, requiredKg: number): number {
  if (requiredKg <= 0) return MAX_RATIO;
  return Math.max(0, Math.min(MAX_RATIO, availableKg / requiredKg));
}
