import { applyWeeklyGrowth, createAnimal } from './animal';
import { WEEKS_PER_RUN, seasonForWeek } from './calendar';
import { outbreakChance, progressWeek } from './disease';
import {
  buyHay,
  evaluateEnding,
  hayPricePerKg,
  sellAnimals,
  techCost,
  weeklyCosts,
} from './economy';
import { drawEvent, findCard } from './events';
import { feedRatio, feedRequirementKg } from './nutrition';
import { averageDegradation, createPastureCells, graze, rest, totalBiomassKg } from './pasture';
import { breedHerd, settleBirths } from './reproduction';
import { chance, mulberry32 } from './rng';
import type { Rng } from './rng';
import { drawWeather, isDisaster } from './weather';
import type {
  Action,
  Animal,
  Effect,
  EventCard,
  LogEntry,
  RunState,
  RunSummary,
} from './types';

const STARTING_MONEY = 12000;
const STARTING_HAY_KG = 2200;
const STARTING_LABOUR = 2;
const STARTING_REPUTATION = 50;
const ACTIONS_PER_WEEK = 3;
const HIRE_COST = 3000;
const VET_BASE_COST = 200;
const VET_PER_HEAD = 50;

export interface RunOptions {
  /** Multiplies the starting herd so experiments can vary stocking rate. */
  herdScale?: number;
}

export function createRun(seed: number, options: RunOptions = {}): RunState {
  return {
    seed,
    week: 1,
    season: 'spring',
    money: STARTING_MONEY,
    hayKg: STARTING_HAY_KG,
    labor: STARTING_LABOUR,
    reputation: STARTING_REPUTATION,
    animals: startingHerd(options.herdScale ?? 1),
    pasture: createPastureCells(4),
    actionsLeft: ACTIONS_PER_WEEK,
    grazedKg: 0,
    weather: 'clear',
    tech: { collared: 0, vaccinated: false, scanned: false },
    usedEvents: [],
    flags: {},
    log: [{ week: 1, text: '开春。草场刚返青，先看看畜群。', tone: 'info' }],
    ended: false,
    ending: null,
  };
}

export function availableActions(state: RunState): Action['kind'][] {
  if (state.ended || state.actionsLeft <= 0) return [];
  return ['graze', 'cut-hay', 'breed', 'vet', 'sell', 'buy-hay', 'tech', 'hire'];
}

export function weekEvent(state: RunState): EventCard | null {
  if (state.ended) return null;
  return drawEvent(state.season, state.usedEvents, rngFor(state, 1));
}

export function applyAction(state: RunState, action: Action): RunState {
  if (state.ended || state.actionsLeft <= 0) return state;
  const next: RunState = { ...state, actionsLeft: state.actionsLeft - 1, log: [...state.log] };

  switch (action.kind) {
    case 'graze': {
      const cell = next.pasture.find((item) => item.id === action.cellId);
      if (!cell) return state;
      const result = graze(cell, alive(next.animals));
      next.pasture = next.pasture.map((item) => (item.id === cell.id ? result.cell : item));
      next.grazedKg += result.consumedKg;
      note(next, `${cell.id} 区放牧，采食 ${Math.round(result.consumedKg)} kg`, 'info');
      break;
    }
    case 'cut-hay': {
      const cell = next.pasture.find((item) => item.id === action.cellId);
      if (!cell) return state;
      const cut = Math.round(cell.biomassKgPerHa * cell.areaHa * 0.1);
      next.hayKg += cut;
      next.pasture = next.pasture.map((item) =>
        item.id === cell.id
          ? { ...item, biomassKgPerHa: Math.max(0, item.biomassKgPerHa * 0.9) }
          : item,
      );
      note(next, `${cell.id} 区割草 ${cut} kg`, 'good');
      break;
    }
    case 'breed': {
      const result = breedHerd(next.animals, rngFor(state, 3));
      next.animals = result.animals;
      note(next, result.conceived > 0 ? `${result.conceived} 头母畜配上种` : '本周没有配上的母畜', result.conceived > 0 ? 'good' : 'info');
      break;
    }
    case 'vet': {
      const sick = next.animals.filter((a) => a.alive && a.health === 'sick').length;
      if (sick === 0) return state;
      const cost = VET_BASE_COST + VET_PER_HEAD * sick;
      if (next.money < cost) return state;
      next.money -= cost;
      next.animals = next.animals.map((a) => (a.alive && a.health === 'sick' ? { ...a, health: 'healthy' } : a));
      note(next, `兽医处理 ${sick} 头，花费 ${cost} 元`, 'good');
      break;
    }
    case 'sell': {
      const result = sellAnimals(next.animals, action.animalIds, state.season);
      if (result.sold === 0) return state;
      next.animals = result.animals;
      next.money += result.revenue;
      next.reputation = clamp(next.reputation + 1, 0, 100);
      note(next, `卖出 ${result.sold} 头，收入 ${result.revenue} 元`, 'good');
      break;
    }
    case 'buy-hay': {
      const price = hayPricePerKg(state.season, state.weather === 'blizzard');
      const result = buyHay(next.money, next.hayKg, action.kg, price);
      if (!result.ok) return state;
      next.money = result.money;
      next.hayKg = result.hayKg;
      note(next, `买入 ${action.kg} kg 干草，花费 ${result.cost} 元`, 'info');
      break;
    }
    case 'tech': {
      if (action.tech === 'collar') {
        const capacity = Math.min(10, alive(next.animals).length - next.tech.collared);
        if (capacity <= 0) return state;
        const cost = techCost('collar', capacity);
        if (next.money < cost) return state;
        next.money -= cost;
        let remaining = capacity;
        next.animals = next.animals.map((a) => {
          if (a.alive && !a.collar && remaining > 0) {
            remaining -= 1;
            return { ...a, collar: true };
          }
          return a;
        });
        next.tech = { ...next.tech, collared: next.tech.collared + capacity };
        note(next, `给 ${capacity} 头戴上项圈，花费 ${cost} 元`, 'good');
      } else if (action.tech === 'vaccine') {
        const cost = techCost('vaccine', alive(next.animals).length);
        if (next.money < cost) return state;
        next.money -= cost;
        next.tech = { ...next.tech, vaccinated: true };
        note(next, `全群免疫，花费 ${cost} 元`, 'good');
      } else {
        const cost = techCost('scan', alive(next.animals).length);
        if (next.money < cost) return state;
        next.money -= cost;
        next.tech = { ...next.tech, scanned: true };
        note(next, `购买草场监测，花费 ${cost} 元`, 'good');
      }
      break;
    }
    case 'hire': {
      if (next.money < HIRE_COST) return state;
      next.money -= HIRE_COST;
      next.labor += 1;
      note(next, '雇了一名帮工', 'info');
      break;
    }
  }

  return next;
}

export function resolveEvent(state: RunState, cardId: string, choiceId: string): RunState {
  const card = findCard(cardId);
  if (!card || state.ended) return state;
  const choice = card.choices.find((item) => item.id === choiceId);
  if (!choice) return state;
  const next: RunState = { ...state, log: [...state.log], usedEvents: [...state.usedEvents, cardId] };
  applyEffect(next, choice.effect);
  note(next, `${card.title}：${choice.label}`, 'info');
  return next;
}

export function endWeek(state: RunState): RunState {
  if (state.ended) return state;
  const next: RunState = { ...state, log: [...state.log] };
  const season = state.season;

  const ratio = feedHerd(next);
  next.animals = next.animals.map((animal) => ({
    ...applyWeeklyGrowth(animal, ratio),
    ageWeeks: animal.ageWeeks + 1,
  }));

  next.pasture = next.pasture.map((cell) => (cell.grazing ? { ...cell, grazing: false } : rest(cell, season)));
  progressDisease(next);
  applyWeather(next);
  next.money = Math.max(0, next.money - weeklyCosts(next.labor, next.tech));
  next.grazedKg = 0;
  next.actionsLeft = ACTIONS_PER_WEEK;
  next.week = Math.min(WEEKS_PER_RUN, next.week + 1);
  next.season = seasonForWeek(next.week);

  if (state.week >= WEEKS_PER_RUN) {
    const births = settleBirths(next.animals, rngFor(next, 10));
    next.animals = births.animals;
    if (births.born > 0) note(next, `接羔 ${births.born} 头`, 'good');
    next.ended = true;
    next.ending = evaluateEnding({
      money: next.money,
      reputation: next.reputation,
      averageDegradation: averageDegradation(next.pasture),
    });
    note(next, `一局结束：${next.ending}`, 'info');
  }

  return next;
}

export function summarize(state: RunState): RunSummary {
  const herd = alive(state.animals);
  return {
    week: state.week,
    season: state.season,
    money: state.money,
    herdSize: herd.length,
    averageBcs: herd.length ? herd.reduce((sum, a) => sum + a.bcs, 0) / herd.length : 0,
    totalBiomassKg: totalBiomassKg(state.pasture),
    averageDegradation: averageDegradation(state.pasture),
    reputation: state.reputation,
    ending: state.ending,
  };
}

function feedHerd(state: RunState): number {
  const requirement = feedRequirementKg(alive(state.animals));
  const available = state.grazedKg + state.hayKg;
  const ratio = feedRatio(available, requirement);
  const hayNeeded = Math.max(0, requirement - state.grazedKg);
  const hayUsed = Math.min(state.hayKg, hayNeeded);
  state.hayKg = Math.round(state.hayKg - hayUsed);
  if (ratio < 0.85) note(state, `草料不足，采食率 ${Math.round(ratio * 100)}%`, 'bad');
  return ratio;
}

function progressDisease(state: RunState): void {
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
  state.animals = progress.animals;
  if (progress.deaths > 0) note(state, `疫病死亡 ${progress.deaths} 头`, 'bad');
}

function applyWeather(state: RunState): void {
  const weather = drawWeather(state.week, rngFor(state, 8));
  state.weather = weather;
  if (!isDisaster(weather)) return;
  const lost = Math.round(state.hayKg * 0.1);
  state.hayKg = Math.max(0, state.hayKg - lost);
  note(state, `暴雪，草料损失 ${lost} kg`, 'bad');
  const victim = alive(state.animals).find(() => chance(rngFor(state, 9), 0.05));
  if (victim) {
    state.animals = state.animals.map((a) => (a.id === victim.id ? { ...a, alive: false } : a));
    note(state, `暴雪中损失 1 头`, 'bad');
  }
}

function applyEffect(state: RunState, effect: Effect): void {
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
  if (effect.loseAnimals) state.animals = kill(state.animals, effect.loseAnimals);
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

function kill(animals: Animal[], count: number): Animal[] {
  let remaining = count;
  return animals.map((animal) => {
    if (remaining > 0 && animal.alive) {
      remaining -= 1;
      return { ...animal, alive: false };
    }
    return animal;
  });
}

function alive(animals: Animal[]): Animal[] {
  return animals.filter((animal) => animal.alive);
}

function note(state: RunState, text: string, tone: LogEntry['tone']): void {
  state.log.push({ week: state.week, text, tone });
}

function rngFor(state: RunState, salt: number): Rng {
  return mulberry32(state.seed * 7919 + state.week * 31 + salt * 17);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function startingHerd(scale = 1): Animal[] {
  const animals: Animal[] = [];
  const yaks = Math.max(1, Math.round(20 * scale));
  const sheep = Math.max(1, Math.round(30 * scale));

  for (let i = 0; i < yaks; i++) {
    animals.push(
      createAnimal({
        id: `yak-${i + 1}`,
        tag: `B-${String(i + 1).padStart(3, '0')}`,
        species: 'yak',
        sex: i < yaks * 0.8 ? 'female' : 'male',
        ageWeeks: 104 + (i % 8) * 26,
      }),
    );
  }
  for (let i = 0; i < sheep; i++) {
    animals.push(
      createAnimal({
        id: `sheep-${i + 1}`,
        tag: `S-${String(i + 1).padStart(3, '0')}`,
        species: 'sheep',
        sex: i < sheep * 0.83 ? 'female' : 'male',
        ageWeeks: 39 + (i % 6) * 13,
      }),
    );
  }
  return animals;
}
