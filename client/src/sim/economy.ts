import { matureWeightKg } from './animal';
import type { Animal, Ending, Season, Species, TechKind } from './types';

const BASE_PRICE: Record<Species, number> = { yak: 7000, sheep: 1000 };

const SEASON_PRICE: Record<Season, number> = {
  spring: 0.92,
  summer: 0.98,
  autumn: 1.08,
  winter: 1,
};

const HAY_BASE_PER_KG = 1.6;
const HAY_SEASON: Record<Season, number> = { spring: 1.1, summer: 1, autumn: 1, winter: 1.5 };

const LABOUR_WEEKLY = 260;
const COLLAR_UPKEEP = 3;
const VACCINE_UPKEEP = 40;
const SCAN_UPKEEP = 30;

const COLLAR_UNIT = 180;
const VACCINE_UNIT = 12;
const SCAN_FLAT = 800;

export function animalPrice(animal: Animal, season: Season): number {
  const mature = matureWeightKg(animal.species, animal.sex);
  const weightFactor = clamp(animal.weightKg / mature, 0.3, 1.3);
  const conditionFactor = 0.85 + animal.bcs * 0.05;
  return Math.round(BASE_PRICE[animal.species] * weightFactor * conditionFactor * SEASON_PRICE[season]);
}

export function hayPricePerKg(season: Season, blizzard: boolean): number {
  return HAY_BASE_PER_KG * HAY_SEASON[season] * (blizzard ? 2 : 1);
}

export function weeklyCosts(
  labour: number,
  tech: { collared: number; vaccinated: boolean; scanned: boolean },
): number {
  return labour * LABOUR_WEEKLY
    + tech.collared * COLLAR_UPKEEP
    + (tech.vaccinated ? VACCINE_UPKEEP : 0)
    + (tech.scanned ? SCAN_UPKEEP : 0);
}

export function sellAnimals(
  animals: Animal[],
  ids: string[],
  season: Season,
): { animals: Animal[]; revenue: number; sold: number } {
  const wanted = new Set(ids);
  let revenue = 0;
  let sold = 0;
  const next = animals.map((animal) => {
    if (!wanted.has(animal.id) || !animal.alive) return animal;
    revenue += animalPrice(animal, season);
    sold += 1;
    return { ...animal, alive: false };
  });
  return { animals: next, revenue, sold };
}

export function buyHay(
  money: number,
  hayKg: number,
  kg: number,
  pricePerKg: number,
): { ok: boolean; money: number; hayKg: number; cost: number } {
  const cost = Math.round(kg * pricePerKg);
  if (kg <= 0 || cost > money) return { ok: false, money, hayKg, cost: 0 };
  return { ok: true, money: money - cost, hayKg: hayKg + kg, cost };
}

export function techCost(tech: TechKind, head: number): number {
  if (tech === 'collar') return COLLAR_UNIT * Math.max(0, head);
  if (tech === 'vaccine') return VACCINE_UNIT * Math.max(0, head);
  return SCAN_FLAT;
}

export function evaluateEnding(input: {
  money: number;
  reputation: number;
  averageDegradation: number;
}): Ending {
  if (input.money <= 0) return 'bankrupt';
  if (input.averageDegradation >= 0.7) return 'collapse';
  if (input.money >= 45000 && input.reputation >= 70) return 'cooperative';
  if (input.money >= 20000) return 'well-off';
  return 'subsistence';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
