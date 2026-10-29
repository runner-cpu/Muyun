import { createAnimal } from './animal';
import { chance } from './rng';
import type { Rng } from './rng';
import type { Animal, Species } from './types';

const MIN_BREEDING_WEEKS: Record<Species, number> = { yak: 104, sheep: 52 };
const MIN_BCS = 2.5;

export function isBreedingEligible(animal: Animal): boolean {
  return (
    animal.alive &&
    animal.sex === 'female' &&
    !animal.pregnant &&
    animal.ageWeeks >= MIN_BREEDING_WEEKS[animal.species] &&
    animal.bcs >= MIN_BCS
  );
}

/** Thin cows do not cycle. Chance rises with condition and caps at 0.9. */
export function conceptionChance(animal: Animal): number {
  return clamp(0.45 + (animal.bcs - MIN_BCS) * 0.25, 0, 0.9);
}

export function breedHerd(
  animals: Animal[],
  rng: Rng,
): { animals: Animal[]; conceived: number } {
  let conceived = 0;
  const next = animals.map((animal) => {
    if (!isBreedingEligible(animal)) return animal;
    if (!chance(rng, conceptionChance(animal))) return animal;
    conceived += 1;
    return { ...animal, pregnant: true };
  });
  return { animals: next, conceived };
}

/**
 * The D version compresses a year into 13 weeks, so gestation is abstracted:
 * every female that conceived during the run gives birth at settlement.
 */
export function settleBirths(
  animals: Animal[],
  rng: Rng,
): { animals: Animal[]; born: number } {
  const next = animals.map((animal) =>
    animal.pregnant ? { ...animal, pregnant: false, lactating: true } : animal,
  );
  const newborns: Animal[] = [];
  let born = 0;

  for (const animal of animals) {
    if (!animal.pregnant) continue;
    born += 1;
    newborns.push(
      createAnimal({
        id: `${animal.id}-c${born}`,
        tag: `${animal.tag}-C${born}`,
        species: animal.species,
        sex: chance(rng, 0.5) ? 'male' : 'female',
        ageWeeks: 0,
      }),
    );
  }

  return { animals: [...next, ...newborns], born };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
