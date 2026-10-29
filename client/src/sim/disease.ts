import { chance } from './rng';
import type { Rng } from './rng';
import type { Animal, Season } from './types';

const BASE_RISK = 0.06;
const HERD_FACTOR = 0.0015;
const VACCINE_RELIEF = 0.04;
const MAX_RISK = 0.6;

const SEASON_RISK: Record<Season, number> = {
  spring: 0.01,
  summer: -0.01,
  autumn: 0,
  winter: 0.06,
};

/** Weekly probability that an outbreak starts, before any mitigation. */
export function outbreakChance(herdSize: number, season: Season, vaccinated: boolean): number {
  const raw = BASE_RISK
    + Math.max(0, herdSize) * HERD_FACTOR
    + SEASON_RISK[season]
    - (vaccinated ? VACCINE_RELIEF : 0);
  return clamp(raw, 0, MAX_RISK);
}

export function sickCount(animals: Animal[]): number {
  return animals.filter((animal) => animal.alive && animal.health === 'sick').length;
}

/**
 * Advances the infection one week: existing cases either die or recover,
 * then each existing case may infect one still-healthy herd mate.
 */
export function progressWeek(
  animals: Animal[],
  rng: Rng,
  treated: boolean,
): { animals: Animal[]; deaths: number; recovered: number; newlySick: number } {
  const next = animals.map((animal) => ({ ...animal }));
  const wasSick = new Set(next.filter((a) => a.alive && a.health === 'sick').map((a) => a.id));
  let deaths = 0;
  let recovered = 0;
  let newlySick = 0;

  const deathChance = treated ? 0.03 : 0.12;
  for (const animal of next) {
    if (!animal.alive || animal.health !== 'sick') continue;
    if (chance(rng, deathChance)) {
      animal.alive = false;
      deaths += 1;
    } else {
      animal.health = 'healthy';
      recovered += 1;
    }
  }

  const infectionChance = treated ? 0.08 : 0.18;
  const infected = new Set<string>();
  for (let i = 0; i < wasSick.size; i++) {
    if (!chance(rng, infectionChance)) continue;
    const target = next.find(
      (a) => a.alive && a.health === 'healthy' && !wasSick.has(a.id) && !infected.has(a.id),
    );
    if (!target) break;
    target.health = 'sick';
    infected.add(target.id);
    newlySick += 1;
  }

  return { animals: next, deaths, recovered, newlySick };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
