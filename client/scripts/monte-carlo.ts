import { mkdirSync, writeFileSync } from 'node:fs';
import { createRun, endWeek, applyAction, resolveEvent, summarize, weekEvent } from '../src/sim/run';
import type { RunState } from '../src/sim/types';

/**
 * A reference policy, not an optimal one. It grazes the richest cell, breeds in
 * spring and autumn, cuts hay when the stack runs low, sells adults in autumn,
 * and always takes the first (usually safest) event option.
 */
function playRun(seed: number, herdScale: number): RunState {
  let state = createRun(seed, { herdScale });

  while (!state.ended) {
    const card = weekEvent(state);
    if (card) state = resolveEvent(state, card.id, card.choices[0].id);
    state = act(state);
    state = endWeek(state);
  }

  return state;
}

function act(state: RunState): RunState {
  let s = state;

  const richest = () => [...s.pasture].sort((a, b) => b.biomassKgPerHa - a.biomassKgPerHa)[0];
  s = applyAction(s, { kind: 'graze', cellId: richest().id });

  if (s.season === 'spring' || s.season === 'autumn') {
    s = applyAction(s, { kind: 'breed' });
  }

  if (s.hayKg < 500) {
    s = applyAction(s, { kind: 'cut-hay', cellId: richest().id });
  }

  if (s.season === 'autumn' && s.actionsLeft > 0) {
    const adults = s.animals
      .filter((animal) => animal.alive && animal.ageWeeks > 150)
      .slice(0, 2)
      .map((animal) => animal.id);
    if (adults.length > 0) s = applyAction(s, { kind: 'sell', animalIds: adults });
  }

  while (s.actionsLeft > 0) {
    const next = applyAction(s, { kind: 'cut-hay', cellId: richest().id });
    if (next === s) break;
    s = next;
  }

  return s;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

const RUNS_PER_SCALE = 250;
const SCALES = [0.6, 0.8, 1.0, 1.2];

interface Row {
  seed: number;
  herdScale: number;
  ending: string;
  week: number;
  money: number;
  herdSize: number;
  averageBcs: number;
  totalBiomassKg: number;
  averageDegradation: number;
  reputation: number;
}

const rows: Row[] = [];

for (const scale of SCALES) {
  for (let i = 0; i < RUNS_PER_SCALE; i++) {
    const seed = Math.round(scale * 1000) + i;
    const summary = summarize(playRun(seed, scale));
    rows.push({
      seed,
      herdScale: scale,
      ending: summary.ending ?? 'none',
      week: summary.week,
      money: summary.money,
      herdSize: summary.herdSize,
      averageBcs: Number(summary.averageBcs.toFixed(2)),
      totalBiomassKg: Math.round(summary.totalBiomassKg),
      averageDegradation: Number(summary.averageDegradation.toFixed(4)),
      reputation: summary.reputation,
    });
  }
}

mkdirSync('reports', { recursive: true });

const header = 'seed,herdScale,ending,week,money,herdSize,averageBcs,totalBiomassKg,averageDegradation,reputation';
const lines = rows.map((row) =>
  [row.seed, row.herdScale, row.ending, row.week, row.money, row.herdSize, row.averageBcs, row.totalBiomassKg, row.averageDegradation, row.reputation].join(','),
);
writeFileSync('reports/monte-carlo.csv', [header, ...lines].join('\n') + '\n');

const summaryHeader = 'herdScale,runs,meanMoney,p10Money,p50Money,p90Money,meanDegradation,collapseRate,bankruptRate,meanHerdSize';
const summaryLines = SCALES.map((scale) => {
  const subset = rows.filter((row) => row.herdScale === scale);
  const money = subset.map((row) => row.money);
  const degradation = subset.reduce((sum, row) => sum + row.averageDegradation, 0) / subset.length;
  const collapse = subset.filter((row) => row.ending === 'collapse').length / subset.length;
  const bankrupt = subset.filter((row) => row.ending === 'bankrupt') .length / subset.length;
  const herd = subset.reduce((sum, row) => sum + row.herdSize, 0) / subset.length;
  return [
    scale,
    subset.length,
    Math.round(money.reduce((a, b) => a + b, 0) / subset.length),
    percentile(money, 0.1),
    percentile(money, 0.5),
    percentile(money, 0.9),
    degradation.toFixed(4),
    collapse.toFixed(3),
    bankrupt.toFixed(3),
    herd.toFixed(1),
  ].join(',');
});
writeFileSync('reports/stocking-summary.csv', [summaryHeader, ...summaryLines].join('\n') + '\n');

console.log(`ran ${rows.length} seasons across ${SCALES.length} stocking rates`);
console.table(
  SCALES.map((scale) => {
    const subset = rows.filter((row) => row.herdScale === scale);
    const money = subset.map((row) => row.money);
    return {
      herdScale: scale,
      meanMoney: Math.round(money.reduce((a, b) => a + b, 0) / subset.length),
      p50: percentile(money, 0.5),
      collapseRate: subset.filter((row) => row.ending === 'collapse').length / subset.length,
      bankruptRate: subset.filter((row) => row.ending === 'bankrupt').length / subset.length,
      meanDegradation: Number((subset.reduce((s, r) => s + r.averageDegradation, 0) / subset.length).toFixed(3)),
    };
  }),
);
console.log('wrote reports/monte-carlo.csv and reports/stocking-summary.csv');
