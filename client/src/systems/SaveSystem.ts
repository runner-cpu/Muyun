import { SAVE_KEY, SAVE_VERSION } from '../config';
import { createDefaultState } from '../core/defaultState';
import type { GameStateData, SaveFile } from '../types';

function safeNumber(value: unknown, fallback: number, min: number, max?: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  if (n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Migrates both the v1 envelope and a legacy "raw data" save (version 0).
 * Unknown fields are dropped, missing fields fall back to defaults.
 */
export function migrateSave(raw: unknown): SaveFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const envelope = raw as Record<string, unknown>;
  const candidate = envelope.data && typeof envelope.data === 'object'
    ? (envelope.data as Record<string, unknown>)
    : envelope;
  const version = typeof envelope.version === 'number' ? envelope.version : 0;
  if (version > SAVE_VERSION) return null;

  const defaults = createDefaultState();
  const settings = candidate.settings && typeof candidate.settings === 'object'
    ? (candidate.settings as Record<string, unknown>)
    : {};
  const player = candidate.player && typeof candidate.player === 'object'
    ? (candidate.player as Record<string, unknown>)
    : {};
  const flags = candidate.flags && typeof candidate.flags === 'object'
    ? Object.fromEntries(Object.entries(candidate.flags as Record<string, unknown>).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>
    : {};

  const data: GameStateData = {
    ...defaults,
    day: Math.round(safeNumber(candidate.day, defaults.day, 1)),
    timeMinutes: Math.round(safeNumber(candidate.timeMinutes, defaults.timeMinutes, 0, 1439)),
    credits: Math.round(safeNumber(candidate.credits, defaults.credits, 0)),
    mood: Math.round(safeNumber(candidate.mood, defaults.mood, 0, 100)),
    flags,
    cats: stringArray(candidate.cats),
    achievements: stringArray(candidate.achievements),
    settings: {
      music: safeNumber(settings.music, defaults.settings.music, 0, 1),
      sfx: safeNumber(settings.sfx, defaults.settings.sfx, 0, 1),
      muted: typeof settings.muted === 'boolean' ? settings.muted : defaults.settings.muted,
    },
    player: {
      x: safeNumber(player.x, defaults.player.x, 0),
      y: safeNumber(player.y, defaults.player.y, 0),
    },
    lastSigninDay: Math.round(safeNumber(candidate.lastSigninDay, 0, 0)),
    signinStreak: Math.round(safeNumber(candidate.signinStreak, 0, 0)),
    hideAttempts: Math.round(safeNumber(candidate.hideAttempts, 0, 0)),
    hideDay: Math.round(safeNumber(candidate.hideDay, 0, 0)),
    lastSaved: Math.round(safeNumber(candidate.lastSaved, 0, 0)),
  };
  // v2 moved to the Qinghai University layout; v3 expanded the map; v4 uses real footprint layout.
  if (version < 4) data.player = { ...defaults.player };
  return { version: SAVE_VERSION, data };
}

export class SaveSystem {
  exists(): boolean {
    try {
      return Boolean(localStorage.getItem(SAVE_KEY));
    } catch {
      return false;
    }
  }

  load(): GameStateData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return migrateSave(JSON.parse(raw))?.data ?? null;
    } catch {
      return null;
    }
  }

  save(data: GameStateData): boolean {
    try {
      const payload: SaveFile = { version: SAVE_VERSION, data: { ...data, lastSaved: Date.now() } };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage may be disabled */
    }
  }
}

export const saveSystem = new SaveSystem();
