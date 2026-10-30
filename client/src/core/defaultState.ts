import { createRun } from '../sim/run';
import { createWinterChallenge } from '../sim/scenarios';
import type { ScenarioId } from '../sim/types';
import type { GameStateData, Settings } from '../types';

/** Spawn point for the placeholder ranch, in world pixels. */
export const SPAWN = { x: 20 * 16, y: 17 * 16 };

export function createDefaultState(seed = Date.now(), scenario: ScenarioId = 'year'): GameStateData {
  const settings: Settings = { music: 0.28, sfx: 0.45, muted: false };
  return {
    run: scenario === 'winter-challenge-v1' ? createWinterChallenge() : createRun(seed),
    settings,
    player: { ...SPAWN },
    lastSaved: 0,
  };
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
