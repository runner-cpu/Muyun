import { outbreakChance, progressWeek } from './disease';
import { chance, mulberry32 } from './rng';
import type { Rng } from './rng';
import { drawWeather, isDisaster } from './weather';
import type { Animal, Effect, LogEntry, RunState } from './types';

export function progressDisease(state: RunState): void {
  const herd = alive(state.animals).length;
  if (chance(rngFor(state, 5), outbreakChance(herd, state.season, state.tech.vaccinated))) {
    const rng = rngFor(state, 6);
    let sickened = 0;
    state.animals = state.animals.map((animal) => {
      if (sickened < 2 && animal.alive && animal.health === 'healthy' && chance(rng, 0.3)) {
        sickened += 1;
        return { ...animal, health: 'sick' as const };
      }
      return animal;
    });
    if (sickened > 0) note(state, `周边疫情传入，${sickened} 头出现症状`, 'bad');
  }

  const progress = progressWeek(state.animals, rngFor(state, 7), false);
  const livingIds = new Set(state.animals.filter(a => a.alive).map(a => a.id));
  state.animals = progress.animals.map(a => !a.alive && livingIds.has(a.id) ? { ...a, exitReason: 'death', exitWeek: state.week } : a);
  if (progress.deaths > 0) note(state, `疫病死亡 ${progress.deaths} 头`, 'bad');
}

export function applyWeather(state: RunState): void {
  const weather = drawWeather(state.week, rngFor(state, 8));
  state.weather = weather;
  if (!isDisaster(weather)) return;
  const lost = Math.round(state.hayKg * 0.1);
  state.hayKg = Math.max(0, state.hayKg - lost);
  note(state, `暴雪，草料损失 ${lost} kg`, 'bad');
  const disasterRng = rngFor(state, 9);
  const victim = alive(state.animals).find(() => chance(disasterRng, 0.05));
  if (victim) {
    state.animals = state.animals.map((a) => (a.id === victim.id ? { ...a, alive: false, exitReason: 'death', exitWeek: state.week } : a));
    note(state, `暴雪中损失 1 头`, 'bad');
  }
}

export function applyEffect(state: RunState, effect: Effect): void {
  if (effect.money) state.money = Math.max(0, state.money + effect.money);
  if (effect.hayKg) state.hayKg = Math.max(0, state.hayKg + effect.hayKg);
  if (effect.reputation) state.reputation = clamp(state.reputation + effect.reputation, 0, 100);
  if (effect.labor) state.labor = Math.max(0, state.labor + effect.labor);
  if (effect.bcsDelta) {
    state.animals = state.animals.map((animal) =>
      animal.alive
        ? { ...animal, bcs: clamp(Math.round((animal.bcs + effect.bcsDelta!) * 100) / 100, 1, 5) }
        : animal,
    );
  }
  if (effect.infect) state.animals = infect(state.animals, effect.infect);
  if (effect.loseAnimals) state.animals = kill(state.animals, effect.loseAnimals, state.week, (effect.money ?? 0) > 0 ? 'sold' : 'death');
  if (effect.degradationDelta) {
    state.pasture = state.pasture.map((cell) => ({
      ...cell,
      degradation: clamp(cell.degradation + effect.degradationDelta!, 0, 1),
    }));
  }
  if (effect.flag) state.flags[effect.flag] = true;
}

function infect(animals: Animal[], count: number): Animal[] {
  let remaining = count;
  return animals.map((animal) => {
    if (remaining > 0 && animal.alive && animal.health === 'healthy') {
      remaining -= 1;
      return { ...animal, health: 'sick' as const };
    }
    return animal;
  });
}

function kill(animals: Animal[], count: number, week: number, reason: 'sold' | 'death'): Animal[] {
  let remaining = count;
  return animals.map((animal) => {
    if (remaining > 0 && animal.alive) {
      remaining -= 1;
      return { ...animal, alive: false, exitReason: reason, exitWeek: week };
    }
    return animal;
  });
}

export function alive(animals: Animal[]): Animal[] {
  return animals.filter((animal) => animal.alive);
}

export function note(state: RunState, text: string, tone: LogEntry['tone']): void {
  state.log.push({ week: state.week, text, tone });
}

export function rngFor(state: RunState, salt: number): Rng {
  return mulberry32(state.seed * 7919 + state.week * 31 + salt * 17);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
