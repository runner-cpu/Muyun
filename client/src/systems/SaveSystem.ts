import { SAVE_KEY, SAVE_VERSION } from '../config';
import { createDefaultState } from '../core/defaultState';
import { createRun } from '../sim/run';
import { clampWeek, seasonForWeek } from '../sim/calendar';
import type { Animal, PastureCell, RunState, Weather } from '../sim/types';
import type { GameStateData, SaveFile } from '../types';

function numberOr(value: unknown, fallback: number, min: number, max?: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, max === undefined ? n : Math.min(max, n));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Rebuilds a run from disk, keeping the seed so the season stays replayable. */
function sanitizeRun(raw: unknown): RunState | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  if (typeof source.seed !== 'number' || typeof source.week !== 'number') return null;
  if (!Array.isArray(source.animals) || !Array.isArray(source.pasture)) return null;

  const seed = source.seed;
  const base = createRun(seed);
  const week = clampWeek(Math.round(source.week));

  return {
    seed,
    week,
    season: seasonForWeek(week),
    money: Math.round(numberOr(source.money, base.money, 0)),
    hayKg: Math.round(numberOr(source.hayKg, base.hayKg, 0)),
    labor: Math.round(numberOr(source.labor, base.labor, 0, 20)),
    reputation: Math.round(numberOr(source.reputation, base.reputation, 0, 100)),
    animals: source.animals as Animal[],
    pasture: source.pasture as PastureCell[],
    actionsLeft: Math.round(numberOr(source.actionsLeft, 3, 0, 3)),
    grazedKg: numberOr(source.grazedKg, 0, 0),
    weather: (source.weather as Weather) ?? 'clear',
    tech: source.tech && typeof source.tech === 'object'
      ? (source.tech as RunState['tech'])
      : base.tech,
    usedEvents: stringArray(source.usedEvents),
    flags: source.flags && typeof source.flags === 'object'
      ? (source.flags as Record<string, boolean>)
      : {},
    log: Array.isArray(source.log) ? (source.log as RunState['log']).slice(-80) : [],
    ended: Boolean(source.ended),
    ending: (source.ending as RunState['ending']) ?? null,
  };
}

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

  const run = version >= SAVE_VERSION ? sanitizeRun(candidate.run) : null;
  const data: GameStateData = {
    run: run ?? defaults.run,
    settings: {
      music: numberOr(settings.music, defaults.settings.music, 0, 1),
      sfx: numberOr(settings.sfx, defaults.settings.sfx, 0, 1),
      muted: typeof settings.muted === 'boolean' ? settings.muted : defaults.settings.muted,
    },
    player: {
      x: numberOr(player.x, defaults.player.x, 0),
      y: numberOr(player.y, defaults.player.y, 0),
    },
    lastSaved: Math.round(numberOr(candidate.lastSaved, 0, 0)),
  };
  // Older saves came from a different world; reset the position.
  if (version < SAVE_VERSION) data.player = { ...defaults.player };
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
