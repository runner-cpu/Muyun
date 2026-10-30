import { createAnimal } from './animal';
import { WEEKS_PER_RUN, seasonForWeek } from './calendar';
import {
  buyHay,
  hayPricePerKg,
  sellAnimals,
  techCost,
} from './economy';
import { drawEvent, findCard } from './events';
import { averageDegradation, createPastureCells, graze, totalBiomassKg } from './pasture';
import { actionLimit, actionStatus, eventChoiceStatus } from './rules';
import { ensureTracking, recordDecision, recordWeek } from './history';
import { settleDeterministic } from './settlement';
import { assessRun } from './assessment';
import { alive, applyEffect, applyWeather, clamp, note, progressDisease, rngFor } from './runEffects';
import { breedHerd, settleBirths } from './reproduction';
import type {
  Action,
  Animal,
  EventCard,
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
  return ensureTracking({
    scenario: 'year',
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
  }, 'new-run');
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
  if (actionStatus(state, action).reason) return state;
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
          ? { ...item, biomassKgPerHa: Math.max(0, item.biomassKgPerHa * 0.9), harvested: true, restedWeeks: 0 }
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
      next.animals = next.animals.map(a => a.exitReason === 'sold' && a.exitWeek === undefined ? { ...a, exitWeek: state.week } : a);
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
        const capacity = Math.min(10, alive(next.animals).filter(a => !a.collar).length);
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
        next.tech = { ...next.tech, collared: alive(next.animals).filter(a => a.collar).length };
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
      note(next, `雇了一名帮工，下周行动上限 ${actionLimit(next)} 点；每周增加 260 元人工费`, 'info');
      break;
    }
  }

  next.tech = { ...next.tech, collared: alive(next.animals).filter(a => a.collar).length };
  return recordDecision(state, next, { kind: 'action', action: JSON.parse(JSON.stringify(action)) as Action });
}

export function resolveEvent(state: RunState, cardId: string, choiceId: string): RunState {
  if (eventChoiceStatus(state, cardId, choiceId).reason) return state;
  const card = findCard(cardId);
  if (!card || state.ended) return state;
  const choice = card.choices.find((item) => item.id === choiceId);
  if (!choice) return state;
  const next: RunState = { ...state, flags: { ...state.flags }, log: [...state.log], usedEvents: [...state.usedEvents, cardId] };
  applyEffect(next, choice.effect);
  note(next, `${card.title}：${choice.label}`, 'info');
  next.tech = { ...next.tech, collared: alive(next.animals).filter(a => a.collar).length };
  return recordDecision(state, next, { kind: 'event', cardId, choiceId });
}

export function endWeek(state: RunState): RunState {
  if (state.ended) return state;
  let next = settleDeterministic(state);
  progressDisease(next);
  applyWeather(next);
  next.tech = { ...next.tech, collared: alive(next.animals).filter(a => a.collar).length };
  next.grazedKg = 0;
  next.actionsLeft = actionLimit(next);

  if (state.week >= WEEKS_PER_RUN) {
    const births = settleBirths(next.animals, rngFor(next, 10));
    next.animals = births.animals;
    if (births.born > 0) note(next, `接羔 ${births.born} 头`, 'good');
    next.ended = true;
    const assessment = assessRun(next);
    next.ending = next.money <= 0 ? 'bankrupt'
      : averageDegradation(next.pasture) >= .7 ? 'collapse'
      : assessment.eligible ? 'cooperative'
      : assessment.economy >= 50 && assessment.health >= 50 && assessment.ecology >= 40 && assessment.retainedShare >= .25 ? 'well-off'
      : 'subsistence';
    const endingName = { bankrupt: '资金耗尽', collapse: '生态失衡', subsistence: '维持经营', 'well-off': '经营有余', cooperative: '均衡经营' }[next.ending];
    note(next, `一局结束：${endingName}`, 'info');
  }
  next = recordWeek(state, next);
  next.week = Math.min(WEEKS_PER_RUN, state.week + 1);
  next.season = seasonForWeek(next.week);
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
