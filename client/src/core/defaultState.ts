import { DAY_START_MINUTES } from '../config';
import type { GameStateData, Settings } from '../types';

export const SPAWN = { x: 54 * 16, y: 10 * 16 };

export function createDefaultState(): GameStateData {
  const settings: Settings = { music: 0.28, sfx: 0.45, muted: false };
  return {
    day: 1,
    timeMinutes: DAY_START_MINUTES,
    credits: 0,
    mood: 50,
    flags: {},
    cats: [],
    achievements: [],
    settings,
    player: { ...SPAWN },
    lastSigninDay: 0,
    signinStreak: 0,
    hideAttempts: 0,
    hideDay: 0,
    lastSaved: 0,
  };
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
