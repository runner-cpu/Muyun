import { captureMetrics } from '../sim/history';
import { restoreRunOrigin } from '../sim/replay';
import { applyAction, endWeek, resolveEvent } from '../sim/run';
import { SIM_VERSION } from '../sim/types';
import type { Decision, RunMetrics, RunState } from '../sim/types';

export const INCOMPLETE_WEEK_ATTRIBUTION = '本周记录不完整，无法核验行动与变化的对应关系；仅展示已记录结算数据。';

interface DecisionStep {
  decision: Decision;
  before: RunState;
  after: RunState;
}

interface ReconstructedWeek {
  before: RunState;
  instant: RunState;
  after: RunState;
  steps: DecisionStep[];
}

const number = (value: number): string => value.toLocaleString('zh-CN');
const yuan = (value: number): string => `¥${number(Math.round(value))}`;
// Overview inventory uses ceil kg; pasture cards use round kg; BCS uses two decimals.
const hayKg = (value: number): string => `${number(Math.ceil(value))} kg`;
const grassKg = (value: number): string => `${number(Math.round(value))} kg`;
const change = (delta: number, format: (value: number) => string): string => delta === 0
  ? '保持不变' : `${delta > 0 ? '增加' : '减少'} ${format(Math.abs(delta))}`;

/**
 * `before` is the real week start, before recorded choices, not the end-week
 * confirmation snapshot (which already includes their instant effects).
 * Re-execute only these recorded choices on a clone and verify the observed end.
 */
export function deriveWeekAttribution(before: RunState, after: RunState, decisions?: readonly Decision[]): string[] {
  try {
    const week = reconstructWeek(before, decisions);
    if (!week || week.after.week !== after.week || week.after.season !== after.season || week.after.ended !== after.ended
      || !matchesMetrics(week.after, captureMetrics(after), after.week)
      || !matchesObservedState(week.after, after)) return [INCOMPLETE_WEEK_ATTRIBUTION];
    return describeWeek(week);
  } catch {
    return [INCOMPLETE_WEEK_ATTRIBUTION];
  }
}

/** Derive both settlement and history text from the same existing recorded evidence. */
export function recordedWeekAttributions(state: RunState): ReadonlyMap<number, readonly string[]> {
  const tracking = state.tracking;
  const records = Array.isArray(tracking?.weeks) ? tracking.weeks : [];
  const result = new Map<number, readonly string[]>(records.map(record => [record.week, [INCOMPLETE_WEEK_ATTRIBUTION]]));
  if (!tracking?.origin || tracking.version !== SIM_VERSION || tracking.origin.ended) return result;
  try {
    let replay = restoreRunOrigin(state);
    const verified = new Map<number, readonly string[]>();
    for (const record of records) {
      if (record.week < tracking.origin.week) continue;
      if (replay.ended || record.week !== replay.week || record.season !== replay.season) return result;
      const week = reconstructWeek(replay, record.decisions);
      if (!week || !matchesMetrics(week.after, record.metrics, record.week)) return result;
      verified.set(record.week, tracking.provenance === 'continued' && record.week === tracking.origin.week
        ? ['本周从续玩起点开始记录，无法完整归因；仅展示已记录结算数据。']
        : describeWeek(week));
      replay = week.after;
    }
    // The player may already have made choices in the next, unsettled week.
    // Replay those choices without another settlement before checking physical
    // evidence: equal aggregate metrics cannot verify a particular cell/animal.
    if (!Array.isArray(tracking.pending)) return result;
    for (const decision of tracking.pending) {
      const next = replayDecision(replay, decision);
      if (!next) return result;
      replay = next;
    }
    if (!matchesObservedState(replay, state)) return result;
    for (const [week, sentences] of verified) result.set(week, sentences);
  } catch {
    // Old or incomplete records keep the explicit fallback; never fill a gap.
  }
  return result;
}

function reconstructWeek(before: RunState, decisions?: readonly Decision[]): ReconstructedWeek | null {
  if (before.ended || !Array.isArray(decisions)) return null;
  let instant = JSON.parse(JSON.stringify(before)) as RunState;
  const steps: DecisionStep[] = [];
  for (const decision of decisions) {
    const previous = instant;
    const next = replayDecision(previous, decision);
    if (!next) return null;
    instant = next;
    steps.push({ decision, before: previous, after: instant });
  }
  return { before, instant, after: endWeek(instant), steps };
}

function replayDecision(state: RunState, decision: Decision): RunState | null {
  const next = decision.kind === 'action' ? applyAction(state, decision.action)
    : decision.kind === 'event' ? resolveEvent(state, decision.cardId, decision.choiceId) : null;
  return next === state ? null : next;
}

function matchesMetrics(after: RunState, recorded: RunMetrics, week: number): boolean {
  const actual = { ...captureMetrics(after), week };
  return !!recorded && (Object.keys(actual) as Array<keyof RunMetrics>)
    .every(key => Number.isFinite(actual[key]) && actual[key] === recorded[key]);
}

/**
 * Aggregate metrics cannot identify a particular pasture cell or animal. Verify
 * the observed physical fields as well before describing either one. UI flags,
 * logs and tracking metadata are deliberately excluded: WeekFlow may add a
 * pending-event flag after settlement without changing the observed outcome.
 */
function matchesObservedState(replayed: RunState, observed: RunState): boolean {
  const physical = (state: RunState) => ({
    scenario: state.scenario ?? 'year', seed: state.seed,
    week: state.week, season: state.season,
    money: state.money, hayKg: state.hayKg, labor: state.labor,
    reputation: state.reputation, actionsLeft: state.actionsLeft,
    grazedKg: state.grazedKg, weather: state.weather,
    tech: [state.tech.collared, state.tech.vaccinated, state.tech.scanned],
    usedEvents: state.usedEvents,
    ended: state.ended, ending: state.ending,
    pasture: state.pasture.map(cell => [
      cell.id, cell.areaHa, cell.biomassKgPerHa, cell.degradation,
      cell.restedWeeks, cell.grazing, cell.harvested ?? false,
    ]),
    animals: state.animals.map(animal => [
      animal.id, animal.tag, animal.species, animal.sex, animal.ageWeeks,
      animal.weightKg, animal.bcs, animal.health, animal.pregnant,
      animal.lactating, animal.collar, animal.alive,
      animal.exitReason ?? null, animal.exitWeek ?? null,
    ]),
  });
  return JSON.stringify(physical(replayed)) === JSON.stringify(physical(observed));
}

function describeWeek(week: ReconstructedWeek): string[] {
  // One verified class keeps the settlement introduction readable on landscape
  // phones. The same priority and sentence are used by historical review.
  const sentences = [pastureSentence(week), purchaseSentence(week), healthSentence(week), saleSentence(week)]
    .filter((sentence): sentence is string => sentence !== null).slice(0, 1);
  return sentences.length ? sentences
    : [`本周没有可核验的行动归因，结算前剩余 ${week.instant.actionsLeft} 点行动未使用。`];
}

function pastureSentence(week: ReconstructedWeek): string | null {
  for (const step of week.steps) {
    if (step.decision.kind !== 'action') continue;
    const action = step.decision.action;
    if (action.kind !== 'graze' && action.kind !== 'cut-hay') continue;
    const before = week.before.pasture.find(cell => cell.id === action.cellId);
    const after = week.after.pasture.find(cell => cell.id === action.cellId);
    if (!before || !after) continue;
    const grass = Math.round(after.biomassKgPerHa * after.areaHa) - Math.round(before.biomassKgPerHa * before.areaHa);
    const degradation = Math.round(after.degradation * 100) - Math.round(before.degradation * 100);
    if (grass === 0 && degradation === 0) continue;
    const amount = action.kind === 'graze'
      ? step.after.grazedKg - step.before.grazedKg : step.after.hayKg - step.before.hayKg;
    if (Math.round(amount) <= 0) continue;
    const effects = [grass !== 0 ? `草量${change(grass, grassKg)}` : '',
      degradation !== 0 ? `退化${change(degradation, value => `${number(value)} 个百分点`)}` : ''].filter(Boolean);
    const event = week.steps.some(item => item.decision.kind === 'event') ? '事件与' : '';
    return `${action.cellId} 区${action.kind === 'graze' ? '放牧采食' : '割草入库'} ${grassKg(amount)}；${effects.join('、')}（含${event}周结算共同影响）。`;
  }
  return null;
}

function purchaseSentence(week: ReconstructedWeek): string | null {
  const purchases = week.steps.filter(step => step.decision.kind === 'action' && step.decision.action.kind === 'buy-hay');
  const bought = purchases.reduce((sum, step) => sum + step.after.hayKg - step.before.hayKg, 0);
  const spent = purchases.reduce((sum, step) => sum + step.before.money - step.after.money, 0);
  const money = Math.round(week.after.money) - Math.round(week.before.money);
  if (bought <= 0 || spent <= 0 || money >= 0) return null;
  const hay = Math.ceil(week.after.hayKg) - Math.ceil(week.before.hayKg);
  return `购草入库 ${hayKg(bought)}、支出 ${yuan(spent)}；全周合计现金${change(money, yuan)}，干草库存${change(hay, hayKg)}。`;
}

function healthSentence(week: ReconstructedWeek): string | null {
  const treated = week.steps.filter(step => step.decision.kind === 'action' && step.decision.action.kind === 'vet')
    .reduce((sum, step) => sum + step.before.animals.filter(animal => animal.alive && animal.health === 'sick'
      && step.after.animals.some(next => next.id === animal.id && next.alive && next.health === 'healthy')).length, 0);
  const vaccinated = week.steps.some(step => step.decision.kind === 'action'
    && step.decision.action.kind === 'tech' && step.decision.action.tech === 'vaccine'
    && !step.before.tech.vaccinated && step.after.tech.vaccinated);
  if (!treated && !vaccinated) return null;
  const before = captureMetrics(week.before);
  const after = captureMetrics(week.after);
  const changed = week.before.animals.filter(animal => animal.alive && week.after.animals
    .some(next => next.id === animal.id && next.alive && next.health !== animal.health)).length;
  const healthy = after.healthyCount - before.healthyCount;
  if (!changed && healthy === 0) return null;
  const health = healthy === 0 ? `健康状态变化 ${changed} 头` : `健康个体${change(healthy, value => `${number(value)} 头`)}`;
  const bcs = before.averageBcs.toFixed(2) === after.averageBcs.toFixed(2) ? ''
    : `、平均 BCS ${before.averageBcs.toFixed(2)}→${after.averageBcs.toFixed(2)}`;
  const action = treated ? `治疗当时使 ${treated} 头患畜恢复健康` : '记录了全群免疫';
  return `${action}；周末${health}${bcs}（含饲喂、疫病共同影响）。`;
}

function saleSentence(week: ReconstructedWeek): string | null {
  const sold = week.steps.filter(step => step.decision.kind === 'action' && step.decision.action.kind === 'sell')
    .reduce((sum, step) => sum + step.before.animals.filter(animal => animal.alive
      && step.after.animals.some(next => next.id === animal.id && !next.alive && next.exitReason === 'sold')).length, 0);
  if (!sold) return null;
  const before = captureMetrics(week.before);
  const after = captureMetrics(week.after);
  if (before.aliveCount === after.aliveCount && before.sheepUnits.toFixed(1) === after.sheepUnits.toFixed(1)) return null;
  return `实际出售 ${sold} 头；周末存栏 ${before.aliveCount}→${after.aliveCount} 头、羊单位 ${before.sheepUnits.toFixed(1)}→${after.sheepUnits.toFixed(1)}（全周合计）。`;
}
