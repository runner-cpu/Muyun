import { ensureTracking } from './history';
import { createRun } from './run';
import type { RunState } from './types';

export const WINTER_CHALLENGE_SEED = 20261030;

/** The four playable winter weeks start directly from this fixed, installed setup. */
export function createWinterChallenge(): RunState {
  const base = createRun(WINTER_CHALLENGE_SEED, { herdScale: 0.6 });
  const { tracking: _tracking, ...untracked } = base;
  const biomass = [700, 560, 420, 320];
  const degradation = [0.1, 0.18, 0.25, 0.32];
  const animals = untracked.animals.map((animal, index) => ({ ...animal, collar: index < 10 }));
  const state: RunState = {
    ...untracked,
    scenario: 'winter-challenge-v1',
    week: 10,
    season: 'winter',
    money: 6000,
    hayKg: 2200,
    animals,
    pasture: untracked.pasture.map((cell, index) => ({
      ...cell,
      biomassKgPerHa: biomass[index],
      degradation: degradation[index],
      restedWeeks: 0,
      grazing: false,
    })),
    tech: { ...untracked.tech, scanned: true, collared: animals.filter(animal => animal.alive && animal.collar).length },
    log: [{ week: 10, text: '越冬挑战：四周经营开始。6000 元为监测与十头项圈安装后的可用现金，设备每周收取维护费。', tone: 'info' }],
  };
  return ensureTracking(state, 'new-run');
}
