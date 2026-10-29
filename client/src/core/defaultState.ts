import type { GameStateData, Settings } from '../types';

/** Spawn point for the placeholder ranch, in world pixels. */
export const SPAWN = { x: 20 * 16, y: 17 * 16 };

export function createDefaultState(): GameStateData {
  const settings: Settings = { music: 0.28, sfx: 0.45, muted: false };
  return {
    week: 1,
    money: 12000,
    hayKg: 800,
    labor: 2,
    reputation: 50,
    flags: {},
    achievements: [],
    settings,
    player: { ...SPAWN },
    lastSaved: 0,
  };
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
