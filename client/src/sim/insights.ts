import { graze, rest } from './pasture';
import { actionStatus, pastureUse } from './rules';
import type { Animal, RunState } from './types';

export interface PastureInsight {
  cellId: string;
  canUse: boolean;
  reason: string | null;
  /** Whole-cell dry matter consumed, in kg. */
  grazeKg: number;
  /** Remaining biomass density, in kg/ha. */
  biomassAfterGrazing: number;
  degradationAfterGrazing: number;
  /** Next-week biomass density after resting, in kg/ha. */
  biomassAfterRest: number;
  degradationAfterRest: number;
}

export interface CollarInsight {
  animalId: string;
  tag: string;
  bcs: number;
  delta: number | null;
  risk: string;
}

/** Deterministic, visible-state alternatives; no future weather or events are sampled. */
export function pastureInsights(state: RunState): PastureInsight[] {
  const herd = state.animals.filter(animal => animal.alive);
  return state.pasture.map(cell => {
    const used = pastureUse(state, cell) !== 'resting';
    const grazing = graze(cell, herd);
    const resting = rest(cell, state.season);
    const reason = actionStatus(state, { kind: 'cut-hay', cellId: cell.id }).reason;
    return {
      cellId: cell.id,
      canUse: reason === null,
      reason,
      grazeKg: used ? 0 : grazing.consumedKg,
      biomassAfterGrazing: used ? cell.biomassKgPerHa : grazing.cell.biomassKgPerHa,
      degradationAfterGrazing: used ? cell.degradation : grazing.cell.degradation,
      biomassAfterRest: used ? cell.biomassKgPerHa : resting.biomassKgPerHa,
      degradationAfterRest: used ? cell.degradation : resting.degradation,
    };
  });
}

/** Only actual collar measurements can establish a trend. */
export function collarInsights(state: RunState): CollarInsight[] {
  return state.animals.filter(animal => animal.alive && animal.collar).map(animal => ({
    animalId: animal.id,
    tag: animal.tag,
    bcs: animal.bcs,
    delta: collarDelta(state, animal),
    risk: animalRisk(animal),
  }));
}

function collarDelta(state: RunState, animal: Animal): number | null {
  const tracking = state.tracking;
  if (!tracking) return null;
  const readings = tracking.weeks
    .filter(record => Number.isFinite(record.collars[animal.id]))
    .sort((a, b) => a.week - b.week);
  if (!readings.length) return null;
  const latest = readings[readings.length - 1].collars[animal.id];

  // The latest settled value is also the new week's initial value. Keep the
  // last completed interval visible, and show subsequent event changes from
  // the most recent measurement when the current value has changed again.
  if (animal.bcs !== latest) return roundedDelta(animal.bcs, latest);
  const previous = readings.length >= 2
    ? readings[readings.length - 2].collars[animal.id]
    : tracking.origin.animals.find(item => item.id === animal.id && item.alive && item.collar)?.bcs;
  return previous === undefined ? null : roundedDelta(animal.bcs, previous);
}

function roundedDelta(current: number, previous: number): number {
  return Math.round((current - previous) * 100) / 100;
}

function animalRisk(animal: Animal): string {
  const risks: string[] = [];
  if (animal.bcs < 2.5) risks.push('偏瘦（BCS < 2.5）');
  if (animal.health === 'sick') risks.push('患病，建议兽医处理');
  if (animal.health === 'subclinical') risks.push('健康关注，继续观察体况');
  return risks.join('；') || '当前无偏瘦或患病关注项';
}
