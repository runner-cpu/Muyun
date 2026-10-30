import { animalPrice, hayPricePerKg, weeklyCosts } from './economy';
import { feedRequirementKg } from './nutrition';
import { averageDegradation, sheepUnitEquivalent, totalBiomassKg } from './pasture';
import { SIM_VERSION } from './types';
import type { Decision, ReplayOrigin, RunMetrics, RunState } from './types';

export function captureMetrics(state: RunState): RunMetrics {
  const herd = state.animals.filter(a => a.alive);
  const herdValue = herd.reduce((sum, a) => sum + animalPrice(a, 'winter'), 0);
  return {
    week: state.week, money: state.money, hayKg: state.hayKg, herdValue,
    netAssets: state.money + herdValue + Math.round(state.hayKg * hayPricePerKg('winter', false)),
    aliveCount: herd.length, sheepUnits: herd.reduce((sum, a) => sum + sheepUnitEquivalent(a), 0),
    averageBcs: herd.length ? herd.reduce((sum, a) => sum + a.bcs, 0) / herd.length : 0,
    healthyCount: herd.filter(a => a.health === 'healthy').length,
    grassKg: totalBiomassKg(state.pasture), averageDegradation: averageDegradation(state.pasture),
    deaths: state.animals.filter(a => a.exitReason === 'death').length,
    sold: state.animals.filter(a => a.exitReason === 'sold').length,
    population: state.animals.length,
    weeklyFeedKg: feedRequirementKg(herd),
    weeklyCost: weeklyCosts(state.labor, { ...state.tech, collared: herd.filter(a => a.collar).length }),
  };
}

export function replayOrigin(state: RunState): ReplayOrigin {
  const { tracking: _tracking, ...origin } = state;
  return JSON.parse(JSON.stringify(origin)) as ReplayOrigin;
}

export function ensureTracking(state: RunState, provenance: 'new-run' | 'continued' = 'continued'): RunState {
  if (state.tracking) return state;
  return { ...state, tracking: {
    version: SIM_VERSION, provenance, origin: replayOrigin(state), baseline: captureMetrics(state), weeks: [], pending: [],
  } };
}

export function recordDecision(before: RunState, after: RunState, decision: Decision): RunState {
  if (before === after) return before;
  const tracked = ensureTracking(before);
  return { ...after, tracking: { ...tracked.tracking!, pending: [...tracked.tracking!.pending, decision] } };
}

/** Called before advancing the calendar; opening events belong to the next record. */
export function recordWeek(before: RunState, after: RunState): RunState {
  const tracking = ensureTracking(before).tracking!;
  const collars = Object.fromEntries(after.animals.filter(a => a.alive && a.collar).map(a => [a.id, a.bcs]));
  return { ...after, tracking: { ...tracking, pending: [], weeks: [...tracking.weeks, {
    week: before.week, season: before.season, decisions: tracking.pending,
    metrics: { ...captureMetrics(after), week: before.week }, collars,
  }].slice(-13) } };
}
