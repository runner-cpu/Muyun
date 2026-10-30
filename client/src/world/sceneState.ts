import type { Animal, PastureCell } from '../sim/types';

/** A stable, bounded sample of real records, with animals needing attention first. */
export function sampleSceneAnimals(animals: Animal[]): Animal[] {
  const priority = (animal: Animal): number => animal.health === 'sick' ? 0
    : animal.bcs < 2.5 ? 1 : animal.health === 'subclinical' ? 2 : animal.collar ? 3 : 4;
  return (['yak', 'sheep'] as const).flatMap(species => {
    const alive = animals.filter(animal => animal.alive && animal.species === species);
    const count = Math.min(18, Math.ceil(alive.length * 0.45));
    return [...alive].sort((a, b) => priority(a) - priority(b) || a.bcs - b.bcs || a.id.localeCompare(b.id)).slice(0, count);
  });
}

/** Grass density and exposed soil vary independently, just like their simulation inputs. */
export function pastureAppearance(cell: Pick<PastureCell, 'biomassKgPerHa' | 'degradation'>): { cover: number; bare: number } {
  const cover = Math.max(0, Math.min(1, cell.biomassKgPerHa / 1500));
  const degradation = Math.max(0, Math.min(1, cell.degradation));
  return { cover, bare: Math.min(0.9, degradation * 0.65 + (1 - cover) * 0.25) };
}
