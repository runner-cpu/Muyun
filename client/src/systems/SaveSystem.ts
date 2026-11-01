import { SAVE_KEY, SAVE_VERSION } from '../config';
import { createDefaultState } from '../core/defaultState';
import { createRun } from '../sim/run';
import { clampWeek, seasonForWeek } from '../sim/calendar';
import { actionLimit, pastureUse } from '../sim/rules';
import { ensureTracking } from '../sim/history';
import { sanitizeTracking } from './trackingSave';
import { SIM_VERSION } from '../sim/types';
import type { Animal, PastureCell, RunState, ScenarioId, Weather } from '../sim/types';
import type { GameStateData, SaveFile } from '../types';

function numberOr(value: unknown, fallback: number, min: number, max?: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, max === undefined ? n : Math.min(max, n));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Rebuilds a run from disk, keeping the seed so the season stays replayable. */
function sanitizeRun(raw: unknown, includeTracking = true): RunState | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  if (typeof source.seed !== 'number' || !Number.isFinite(source.seed) || typeof source.week !== 'number' || !Number.isFinite(source.week)) return null;
  if (!Array.isArray(source.animals) || !Array.isArray(source.pasture)) return null;

  const seed = source.seed;
  const base = createRun(seed);
  const week = clampWeek(Math.round(source.week));

  const labor = Math.round(numberOr(source.labor, base.labor, 0, 20));
  if (source.animals.length > 1000 || source.pasture.length !== 4) return null;
  const animals = (source.animals as Animal[]).map(animal => ({ ...animal }));
  if (!animals.every(a => a && typeof a.id === 'string' && typeof a.tag === 'string' && ['yak', 'sheep'].includes(a.species) && ['male', 'female'].includes(a.sex) && [a.bcs, a.weightKg, a.ageWeeks].every(Number.isFinite) && typeof a.alive === 'boolean')) return null;
  if (new Set(animals.map(a => a.id)).size !== animals.length || !animals.every(a =>
    a.id.length > 0 && a.id.length <= 80 && a.tag.length <= 80 && a.weightKg >= 0 && a.ageWeeks >= 0
    && a.bcs >= 1 && a.bcs <= 5 && ['healthy', 'subclinical', 'sick'].includes(a.health)
    && [a.pregnant, a.lactating, a.collar].every(value => typeof value === 'boolean'))) return null;
  const rawPasture = (source.pasture as PastureCell[]).slice(0, 4);
  if (!rawPasture.length || !rawPasture.every(p => p && typeof p.id === 'string' && [p.areaHa, p.biomassKgPerHa, p.degradation, p.restedWeeks].every(Number.isFinite))) return null;
  if (new Set(rawPasture.map(p => p.id)).size !== 4 || rawPasture.some(p => !['P1', 'P2', 'P3', 'P4'].includes(p.id))) return null;
  if (source.scenario !== undefined && source.scenario !== 'year' && source.scenario !== 'winter-challenge-v1') return null;
  if (source.scenario === 'winter-challenge-v1' && week < 10) return null;
  const pasture: PastureCell[] = rawPasture.map(cell => ({
    id: cell.id, areaHa: Math.max(0.01, cell.areaHa), biomassKgPerHa: Math.max(0, cell.biomassKgPerHa),
    degradation: Math.max(0, Math.min(1, cell.degradation)), restedWeeks: Math.max(0, Math.floor(cell.restedWeeks)),
    grazing: cell.grazing === true, harvested: cell.harvested === true,
  }));
  const rawTech = source.tech && typeof source.tech === 'object' ? source.tech as Record<string, unknown> : {};
  const result: RunState = {
    scenario: source.scenario === 'winter-challenge-v1' ? 'winter-challenge-v1' : 'year',
    seed,
    week,
    season: seasonForWeek(week),
    money: Math.round(numberOr(source.money, base.money, 0)),
    hayKg: Math.round(numberOr(source.hayKg, base.hayKg, 0)),
    labor,
    reputation: Math.round(numberOr(source.reputation, base.reputation, 0, 100)),
    animals,
    pasture,
    actionsLeft: Math.round(numberOr(source.actionsLeft, 3, 0, actionLimit({ labor }))),
    grazedKg: numberOr(source.grazedKg, 0, 0),
    weather: ['clear', 'wind', 'snow', 'blizzard'].includes(String(source.weather)) ? source.weather as Weather : 'clear',
    tech: { collared: animals.filter(a => a.alive && a.collar).length, vaccinated: Boolean(rawTech.vaccinated), scanned: Boolean(rawTech.scanned) },
    usedEvents: stringArray(source.usedEvents),
    flags: source.flags && typeof source.flags === 'object'
      ? Object.fromEntries(Object.entries(source.flags).filter(([key, value]) => key.length < 160 && typeof value === 'boolean').slice(0, 200)) : {},
    log: Array.isArray(source.log) ? source.log.slice(-80).flatMap(entry =>
      entry && typeof entry === 'object' && Number.isInteger(entry.week) && entry.week >= 1 && entry.week <= 13
      && typeof entry.text === 'string' && ['good', 'bad', 'info'].includes(entry.tone)
        ? [{ week: entry.week, text: entry.text.slice(0, 2000), tone: entry.tone }] : []) : [],
    ended: Boolean(source.ended),
    ending: ['bankrupt', 'collapse', 'subsistence', 'well-off', 'cooperative'].includes(String(source.ending)) ? source.ending as RunState['ending'] : null,
  };
  if (!includeTracking) return result;
  result.tracking = sanitizeTracking(source.tracking, result, value => sanitizeRun(value, false));
  const rawTracking = source.tracking && typeof source.tracking === 'object' ? source.tracking as Record<string, unknown> : null;
  if (typeof rawTracking?.version === 'string' && rawTracking.version !== SIM_VERSION) {
    // Preserve known current-week utilization before resetting the recording
    // boundary. Historical actions must never be replayed under newer rules.
    result.pasture = result.pasture.map(cell => {
      const use = pastureUse(result, cell);
      return use === 'resting' ? cell : { ...cell, grazing: use === 'grazed', harvested: use === 'cut', restedWeeks: 0 };
    });
    delete result.tracking;
    result.log = [...result.log, {
      week: result.week,
      text: result.ended
        ? `模拟规则已升级至 ${SIM_VERSION}，本局已结束，保留当前状态快照；旧规则历史不参与重放与策略对照。`
        : `模拟规则已升级至 ${SIM_VERSION}，保留当前经营进度；从第 ${result.week} 周当前状态重新记录，旧规则历史不参与重放与策略对照。`,
      tone: 'info',
    }];
  }
  return ensureTracking(result);
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
  // A damaged current save is not a new game: keep the original slot untouched.
  if (version >= SAVE_VERSION && !run) return null;
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
  private active: ScenarioId = 'year';
  private exitSaveSuppressed = new Set<ScenarioId>();
  setMode(scenario: ScenarioId): void { this.active = scenario; }
  private key(scenario = this.active): string { return scenario === 'winter-challenge-v1' ? `${SAVE_KEY}-winter` : SAVE_KEY; }

  exists(scenario?: ScenarioId): boolean {
    try {
      return Boolean(localStorage.getItem(this.key(scenario)));
    } catch {
      return false;
    }
  }

  load(scenario?: ScenarioId): GameStateData | null {
    try {
      const raw = localStorage.getItem(this.key(scenario));
      if (!raw) return null;
      const data = migrateSave(JSON.parse(raw))?.data;
      return data && (data.run.scenario ?? 'year') === (scenario ?? this.active) ? data : null;
    } catch {
      return null;
    }
  }

  save(data: GameStateData): boolean {
    try {
      const payload: SaveFile = { version: SAVE_VERSION, data: { ...data, lastSaved: Date.now() } };
      const mode = data.run.scenario ?? 'year';
      localStorage.setItem(this.key(mode), JSON.stringify(payload));
      this.active = mode;
      this.exitSaveSuppressed.delete(mode);
      return true;
    } catch {
      return false;
    }
  }

  /** Exit hooks must not recreate a slot deliberately cleared before reload. */
  saveOnExit(data: GameStateData): boolean {
    if (this.exitSaveSuppressed.has(data.run.scenario ?? 'year')) return false;
    return this.save(data);
  }

  clear(scenario?: ScenarioId, options: { suppressExitSave?: boolean } = {}): boolean {
    const mode = scenario ?? this.active;
    try {
      localStorage.removeItem(this.key(mode));
      if (options.suppressExitSave) this.exitSaveSuppressed.add(mode);
      return true;
    } catch {
      return false;
    }
  }
}

export const saveSystem = new SaveSystem();
