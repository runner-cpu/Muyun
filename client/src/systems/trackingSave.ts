import type { Action, Decision, RunMetrics, RunState, RunTracking, WeekRecord } from '../sim/types';

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const metricKeys: (keyof RunMetrics)[] = ['week', 'money', 'hayKg', 'herdValue', 'netAssets', 'aliveCount', 'sheepUnits', 'averageBcs', 'healthyCount', 'grassKg', 'averageDegradation', 'deaths', 'sold', 'population', 'weeklyFeedKg', 'weeklyCost'];

function metrics(raw: unknown): RunMetrics | null {
  const value = object(raw);
  if (!value || metricKeys.some(key => typeof value[key] !== 'number' || !Number.isFinite(value[key]) || (value[key] as number) < 0)) return null;
  return Object.fromEntries(metricKeys.map(key => [key, value[key]])) as unknown as RunMetrics;
}

function decision(raw: unknown): Decision | null {
  const d = object(raw);
  if (d?.kind === 'event' && typeof d.cardId === 'string' && typeof d.choiceId === 'string') {
    return { kind: 'event', cardId: d.cardId.slice(0, 80), choiceId: d.choiceId.slice(0, 80) };
  }
  const a = object(d?.action);
  if (d?.kind !== 'action' || !a) return null;
  let action: Action;
  switch (a.kind) {
    case 'graze': case 'cut-hay':
      if (typeof a.cellId !== 'string') return null;
      action = { kind: a.kind, cellId: a.cellId.slice(0, 80) }; break;
    case 'breed': case 'vet': case 'hire': action = { kind: a.kind }; break;
    case 'sell':
      if (!Array.isArray(a.animalIds) || a.animalIds.some(id => typeof id !== 'string')) return null;
      action = { kind: 'sell', animalIds: a.animalIds.slice(0, 1000).map(id => id.slice(0, 80)) }; break;
    case 'buy-hay':
      if (typeof a.kg !== 'number' || !Number.isFinite(a.kg) || a.kg <= 0) return null;
      action = { kind: 'buy-hay', kg: a.kg }; break;
    case 'tech':
      if (!['collar', 'scan', 'vaccine'].includes(String(a.tech))) return null;
      action = { kind: 'tech', tech: a.tech as 'collar' | 'scan' | 'vaccine' }; break;
    default: return null;
  }
  return { kind: 'action', action };
}

function decisions(raw: unknown): Decision[] | null {
  if (!Array.isArray(raw) || raw.length > 20) return null;
  const values = raw.map(decision);
  return values.some(v => v === null) ? null : values as Decision[];
}

export function sanitizeTracking(raw: unknown, state: RunState, parseOrigin: (value: unknown) => RunState | null): RunTracking | undefined {
  const data = object(raw);
  if (!data || typeof data.version !== 'string' || !['new-run', 'continued'].includes(String(data.provenance))) return;
  const origin = parseOrigin(data.origin);
  const baseline = metrics(data.baseline);
  const pending = decisions(data.pending);
  if (!origin || origin.ended || origin.seed !== state.seed || origin.week > state.week || !baseline || !pending || !Array.isArray(data.weeks) || data.weeks.length > 13) return;
  const weeks: WeekRecord[] = [];
  for (const rawWeek of data.weeks) {
    const w = object(rawWeek);
    const m = metrics(w?.metrics);
    const d = decisions(w?.decisions);
    const collars = object(w?.collars);
    if (!w || typeof w.week !== 'number' || !Number.isInteger(w.week) || w.week < origin.week || w.week > state.week || !['spring', 'summer', 'autumn', 'winter'].includes(String(w.season)) || !m || !d || !collars || (weeks.length && w.week !== weeks.at(-1)!.week + 1)) return;
    const validCollars = Object.fromEntries(Object.entries(collars).filter(([id, value]) => id.length < 81 && typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5).slice(0, 1000));
    weeks.push({ week: w.week, season: w.season as WeekRecord['season'], decisions: d, metrics: m, collars: validCollars as Record<string, number> });
  }
  return { version: data.version.slice(0, 80), provenance: data.provenance as RunTracking['provenance'], origin, baseline, weeks, pending };
}
