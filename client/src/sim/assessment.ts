import { captureMetrics } from './history';
import type { RunMetrics, RunState } from './types';

export interface Assessment {
  metrics: RunMetrics;
  baseline: RunMetrics;
  economy: number;
  ecology: number;
  health: number;
  overall: number;
  eligible: boolean;
  retainedShare: number;
  knownDeaths: number;
  births: number;
}

/** Public game-design scores. Missing history starts at the observable current state. */
export function assessRun(state: RunState): Assessment {
  const metrics = captureMetrics(state);
  const baseline = state.tracking?.baseline ?? metrics;
  const knownDeaths = Math.max(0, metrics.deaths - baseline.deaths);
  const births = Math.max(0, metrics.population - baseline.population);
  const populationAtRisk = baseline.aliveCount + births;
  const survival = populationAtRisk > 0 ? unit(1 - knownDeaths / populationAtRisk) : 0;
  const retainedShare = baseline.sheepUnits > 0 ? metrics.sheepUnits / baseline.sheepUnits : 0;

  // A zero-asset start has no percentage denominator. Zero stays at parity;
  // any positive assets reach the upper bound without returning Infinity/NaN.
  const assetRatio = baseline.netAssets > 0
    ? metrics.netAssets / baseline.netAssets
    : metrics.netAssets > 0 ? 1.2 : 1;
  const economy = unit(0.5 + (assetRatio - 1) / 0.4) * 100;
  const grassShare = baseline.grassKg > 0 ? unit(metrics.grassKg / baseline.grassKg) : 0;
  const ecology = (0.7 * unit(1 - metrics.averageDegradation) + 0.3 * grassShare) * 100;
  const health = metrics.aliveCount > 0
    ? (0.4 * unit((metrics.averageBcs - 1) / 2)
      + 0.3 * unit(metrics.healthyCount / metrics.aliveCount)
      + 0.3 * survival) * 100
    : 0;
  const overall = (economy + ecology + health) / 3;
  const eligible = economy >= 40 && ecology >= 60 && health >= 70
    && retainedShare >= 0.5 && metrics.money > 0;

  return { metrics, baseline, economy, ecology, health, overall, eligible, retainedShare, knownDeaths, births };
}

function unit(value: number): number {
  return Math.max(0, Math.min(1, value));
}
