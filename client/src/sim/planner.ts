import { assessRun } from './assessment';
import { hayPricePerKg, weeklyCosts } from './economy';
import { captureMetrics, ensureTracking } from './history';
import { feedRequirementKg } from './nutrition';
import { sheepUnitEquivalent } from './pasture';
import { actionStatus, pastureUse } from './rules';
import { applyAction } from './run';
import { settleDeterministic } from './settlement';
import type { Action, RunMetrics, RunState } from './types';

export const SEARCH_WIDTH = 24;
export const SEARCH_DEPTH = 5;
export const MAX_CANDIDATES = 16;
/** One root expansion, then at most 24 expanded nodes on each later layer. */
export const MAX_EXPANDED_NODES = MAX_CANDIDATES * (1 + SEARCH_WIDTH * (SEARCH_DEPTH - 1));

export const PLANNER_VERSION = 'beam-profile-v2';
export type PlanningProfile = 'balanced' | 'ecology' | 'assets';
export interface PlanWeights { readonly feed: number; readonly ecology: number; readonly health: number; readonly value: number }
export interface PlanProfile { readonly id: PlanningProfile; readonly label: string; readonly description: string; readonly weights: PlanWeights }
const profile = (id: PlanningProfile, label: string, description: string, weights: PlanWeights): PlanProfile => Object.freeze({ id, label, description, weights: Object.freeze(weights) });
export const PLAN_PROFILES: Readonly<Record<PlanningProfile, PlanProfile>> = Object.freeze({
  balanced: profile('balanced', '均衡经营', '兼顾本周饲草、草场、健康与资产。', { feed: 45, ecology: 20, health: 20, value: 15 }),
  ecology: profile('ecology', '草场优先', '在饲草和现金条件满足后，更重视草场退化。', { feed: 45, ecology: 35, health: 15, value: 5 }),
  assets: profile('assets', '资产优先', '在饲草和现金条件满足后，更重视本周净资产。', { feed: 45, ecology: 10, health: 15, value: 30 }),
});
export interface PlanComponent { value: number; weight: number; points: number }
export type PlanComponents = Record<keyof PlanWeights, PlanComponent>;

export interface PlanResult {
  profile: PlanningProfile;
  components: PlanComponents;
  actions: Action[];
  score: number;
  metrics: RunMetrics;
  expanded: number;
  elapsedMs: number;
  lockedReason: string | null;
  safe: boolean;
  explanation: string;
  feedCoverage: number;
  feedNeedKg: number;
  feedGapKg: number;
}

interface Node {
  state: RunState;
  actions: Action[];
  usedCells: Set<string>;
  result: PlanResult;
  key: string;
}

/** Current visible resources only: no future weather, event or disease sampling. */
export function planWeek(state: RunState, profile: PlanningProfile = 'balanced'): PlanResult {
  const started = performance.now();
  if (state.ended || !state.tech.scanned) {
    const reason = state.ended ? '本局已经结束，不能再试算本周行动。' : '开通草场监测后可运行参考方案；开通需现金和一个行动点。';
    return {
      profile, components: scoreComponents(PLAN_PROFILES[profile].weights, 0, 0, 0, 0),
      actions: [], score: 0, metrics: captureMetrics(state), expanded: 0,
      elapsedMs: performance.now() - started, lockedReason: reason, safe: false,
      explanation: reason, ...feedAvailability(state),
    };
  }

  // Planner health and economy use this visible starting point, even for a
  // continued save whose real run baseline predates this week's experiment.
  const tracked = ensureTracking(state);
  const trial: RunState = { ...tracked, tracking: { ...tracked.tracking!, baseline: captureMetrics(state) } };
  const minimumUnits = sheepUnits(state) / 2;
  const usedCells = new Set<string>();
  for (const cell of state.pasture) if (pastureUse(state, cell) !== 'resting') usedCells.add(cell.id);

  const root = makeNode(trial, [], usedCells, profile);
  let best = root;
  let beam = [root];
  let expanded = 0;
  const depth = Math.min(SEARCH_DEPTH, Math.max(0, Math.floor(state.actionsLeft)));

  for (let layer = 0; layer < depth && beam.length; layer += 1) {
    const nextLayer: Node[] = [];
    for (const node of beam) {
      for (const action of candidates(node.state, node.usedCells, minimumUnits)) {
        const next = applyAction(node.state, action);
        if (next === node.state || sheepUnits(next) + 1e-9 < minimumUnits) continue;
        expanded += 1;
        const nextUsed = new Set(node.usedCells);
        if (action.kind === 'graze' || action.kind === 'cut-hay') nextUsed.add(action.cellId);
        const child = makeNode(next, [...node.actions, action], nextUsed, profile);
        nextLayer.push(child);
        if (compareNodes(child, best) < 0) best = child;
      }
    }
    nextLayer.sort(compareNodes);
    beam = nextLayer.slice(0, SEARCH_WIDTH);
  }

  const weights = PLAN_PROFILES[profile].weights;
  const formula = `${weights.feed}F + ${weights.ecology}E + ${weights.health}H + ${weights.value}V`;
  return {
    ...best.result, expanded, elapsedMs: performance.now() - started,
    explanation: best.result.safe
      ? `参考方案覆盖本周饲草，确定性结算后现金 ${Math.round(best.result.metrics.money)} 元；可提前停止，不必用完行动。评分按 ${formula}，保留试算起点至少一半羊单位。未计未来天气、事件与疫病，有限搜索不保证最优。`
      : `当前搜索未找到同时足草且结算现金大于零的方案；本方案仍缺草 ${Math.ceil(best.result.feedGapKg)} kg，确定性结算后现金 ${Math.round(best.result.metrics.money)} 元。保留试算起点至少一半羊单位；未计未来天气、事件与疫病，有限搜索不保证最优。`,
  };
}

function makeNode(state: RunState, actions: Action[], usedCells: Set<string>, profile: PlanningProfile): Node {
  const feed = feedAvailability(state);
  const settled = settleDeterministic(state);
  const assessment = assessRun(settled);
  const ecology = clamp(1 - assessment.metrics.averageDegradation);
  const health = clamp(assessment.health / 100);
  const value = clamp(assessment.economy / 100);
  const components = scoreComponents(PLAN_PROFILES[profile].weights, feed.feedCoverage, ecology, health, value);
  // Preserve the exact left-to-right arithmetic of the original balanced score.
  const score = components.feed.points + components.ecology.points + components.health.points + components.value.points;
  return {
    state, actions, usedCells, key: JSON.stringify(actions),
    result: {
      profile, components,
      actions, score, metrics: assessment.metrics, expanded: 0, elapsedMs: 0,
      lockedReason: null, safe: feed.feedGapKg <= 1e-6 && settled.money > 0,
      explanation: '', ...feed,
    },
  };
}

function scoreComponents(weights: PlanWeights, feed: number, ecology: number, health: number, value: number): PlanComponents {
  const component = (key: keyof PlanWeights, normalized: number): PlanComponent => ({ value: normalized, weight: weights[key], points: weights[key] * normalized });
  return { feed: component('feed', feed), ecology: component('ecology', ecology), health: component('health', health), value: component('value', value) };
}

/** At most 8 pasture + 5 hay + treatment + vaccination + one sale. */
function candidates(state: RunState, usedCells: Set<string>, minimumUnits: number): Action[] {
  const actions: Action[] = [];
  for (const cell of state.pasture.slice(0, 4)) {
    if (usedCells.has(cell.id)) continue;
    actions.push({ kind: 'graze', cellId: cell.id }, { kind: 'cut-hay', cellId: cell.id });
  }
  const feed = feedAvailability(state);
  const hayCandidates = new Set([
    roundHay(feed.feedGapKg),
    roundHay(feed.feedGapKg + feed.feedNeedKg / 2),
    roundHay(feed.feedGapKg + feed.feedNeedKg),
  ]);
  if (feed.feedGapKg > 1e-6) {
    // Whole-kg top-ups can be affordable when a 100-kg purchase exhausts cash.
    const exactTopUp = Math.ceil(feed.feedGapKg);
    hayCandidates.add(exactTopUp);
    const maintenance = weeklyCosts(state.labor, {
      ...state.tech, collared: state.animals.filter(animal => animal.alive && animal.collar).length,
    });
    const price = hayPricePerKg(state.season, state.weather === 'blizzard');
    const hayBudget = Math.max(0, Math.floor(state.money - maintenance - 1));
    const affordable = Math.floor(hayBudget / price);
    // If a full top-up is impossible, keep a bounded partial-feed alternative
    // that still reserves this week's maintenance and at least one cash unit.
    if (affordable > 0 && affordable < exactTopUp) hayCandidates.add(affordable);
  }
  for (const kg of hayCandidates) actions.push({ kind: 'buy-hay', kg });
  actions.push({ kind: 'vet' }, { kind: 'tech', tech: 'vaccine' });

  const units = sheepUnits(state);
  const sale = state.animals.filter(a => a.alive && units - sheepUnitEquivalent(a) + 1e-9 >= minimumUnits)
    .sort((a, b) => Number(b.health === 'sick') - Number(a.health === 'sick') || a.bcs - b.bcs || b.ageWeeks - a.ageWeeks || a.id.localeCompare(b.id))[0];
  if (sale) actions.push({ kind: 'sell', animalIds: [sale.id] });
  return actions.filter(action => actionStatus(state, action).reason === null).slice(0, MAX_CANDIDATES);
}

function compareNodes(a: Node, b: Node): number {
  return Number(b.result.safe) - Number(a.result.safe)
    || b.result.score - a.result.score
    || a.actions.length - b.actions.length
    || a.key.localeCompare(b.key);
}

function sheepUnits(state: RunState): number {
  return state.animals.reduce((sum, animal) => sum + (animal.alive ? sheepUnitEquivalent(animal) : 0), 0);
}

function feedAvailability(state: RunState) {
  const feedNeedKg = feedRequirementKg(state.animals.filter(a => a.alive));
  const available = state.grazedKg + state.hayKg;
  return {
    feedNeedKg, feedGapKg: Math.max(0, feedNeedKg - available),
    feedCoverage: feedNeedKg > 0 ? clamp(available / feedNeedKg) : 1,
  };
}

function roundHay(kg: number): number { return Math.max(100, Math.ceil(kg / 100) * 100); }
function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
