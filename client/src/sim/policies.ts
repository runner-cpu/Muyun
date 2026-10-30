import { assessRun } from './assessment';
import { hayPricePerKg } from './economy';
import { findCard } from './events';
import { ensureTracking } from './history';
import { feedRequirementKg } from './nutrition';
import { planWeek } from './planner';
import { hasRecordedInterval, restoreRunOrigin } from './replay';
import { actionStatus, eventChoiceStatus, pastureUse } from './rules';
import { applyAction, endWeek, resolveEvent, weekEvent } from './run';
import { SIM_VERSION } from './types';
import type { Action, EventCard, RunMetrics, RunState, RunTracking } from './types';

export type PolicyId = 'greedy' | 'search';
export interface PolicyRun {
  state: RunState;
  actions: number;
  expanded: number;
  elapsedMs: number;
  searchMs: number;
  failure: string | null;
  notes: string[];
}
export interface PolicyRow {
  id: 'player' | PolicyId;
  label: string;
  metrics: RunMetrics;
  assessment: ReturnType<typeof assessRun>;
  actions: number;
  expanded: number;
  elapsedMs: number;
  outcome: PolicyOutcome;
  failure?: string | null;
}
export interface PolicyOutcome {
  completed: boolean;
  /** True only for a completed run meeting the existing assessment conditions. */
  goalReached: boolean;
  /** Uses the actual recorded run baseline, not a rolling weekly threshold. */
  retainedShare: number;
  retainedHalf: boolean;
}
export interface PolicyComparison {
  available: boolean;
  reason: string | null;
  fromWeek: number;
  toWeek: number;
  provenance: RunTracking['provenance'];
  rows: PolicyRow[];
  notes: string[];
}

/** Finished runs only: live comparison must not expose future random outcomes. */
export function comparePolicies(state: RunState): PolicyComparison {
  const tracking = ensureTracking(state).tracking!;
  const base = {
    fromWeek: tracking.origin.week, toWeek: state.week, provenance: tracking.provenance,
  };
  if (!state.ended) return { ...base, available: false, reason: '本局结束后开放同起点策略对照。', rows: [], notes: [] };
  if (tracking.version !== SIM_VERSION) return {
    ...base, available: false,
    reason: `记录使用模拟版本 ${tracking.version}，当前版本为 ${SIM_VERSION}，无法保证同规则对照。`,
    rows: [], notes: [],
  };
  if (!hasRecordedInterval(tracking, state.week)) return {
    ...base, available: false,
    reason: '该存档没有可玩的历史起点与已记录经营区间，无法进行策略对照；现有完局进度保留。',
    rows: [], notes: [],
  };
  const playerAssessment = assessRun(state);
  const decisions = [...tracking.weeks.flatMap(w => w.decisions), ...tracking.pending];
  const rows: PolicyRow[] = [{
    id: 'player', label: '玩家记录', metrics: playerAssessment.metrics, assessment: playerAssessment,
    actions: decisions.filter(d => d.kind === 'action').length, expanded: 0, elapsedMs: 0,
    outcome: policyOutcome(state, null, playerAssessment),
  }];
  const notes = [
    '三方从同一真实记录起点和 seed 开始；两种自动策略的事件统一选择首个合法且可支付的选项，玩家保留真实选择。',
    '搜索策略实际支付监测购置、行动和维护成本；买不起时使用固定贪心规则。',
    '相同 seed 可重现结果；风险也取决于策略改变后的畜群状态，因此三方损失未必相同。',
  ];
  if (tracking.provenance === 'continued') notes.push(`仅比较第 ${tracking.origin.week} 周起的续玩区间，之前的历史未记录。`);
  for (const id of ['greedy', 'search'] as const) {
    const run = simulatePolicy(restoreRunOrigin(state), id);
    const assessment = assessRun(run.state);
    rows.push({
      id, label: id === 'greedy' ? '固定贪心基线' : '每周受约束搜索',
      metrics: assessment.metrics, assessment, actions: run.actions,
      expanded: run.expanded, elapsedMs: run.elapsedMs, failure: run.failure,
      outcome: policyOutcome(run.state, run.failure, assessment),
    });
    notes.push(...run.notes.map(note => `${id === 'greedy' ? '基线' : '搜索'}：${note}`));
  }
  return { ...base, available: true, reason: null, rows, notes };
}

/** Completion, task achievement and survival are separate experimental outcomes. */
export function policyOutcome(state: RunState, failure: string | null = null, assessment = assessRun(state)): PolicyOutcome {
  const completed = state.ended && failure === null;
  return {
    completed, goalReached: completed && assessment.eligible,
    retainedShare: assessment.retainedShare, retainedHalf: assessment.retainedShare >= 0.5,
  };
}

/** Plays an already-restored actual origin through the same production engine. */
export function simulatePolicy(origin: RunState, policy: PolicyId): PolicyRun {
  const started = performance.now();
  let state = origin;
  let actions = 0;
  let expanded = 0;
  let searchMs = 0;
  let failure: string | null = null;
  const notes: string[] = [];
  // A continuation may already have an explicitly pending event. The first
  // playable week otherwise has no extra opening draw, exactly like the UI.
  const initialCard = pendingCard(state);
  if (initialCard) {
    const resolved = chooseEvent(state, initialCard);
    if (!resolved) failure = `第 ${state.week} 周事件“${initialCard.title}”没有可支付选项。`;
    else state = resolved;
  }

  let weeks = 0;
  while (!state.ended && !failure && weeks < 13) {
    if (policy === 'search') {
      if (!state.tech.scanned) {
        const install: Action = { kind: 'tech', tech: 'scan' };
        const reason = actionStatus(state, install).reason;
        if (reason === null) {
          const installed = applyAction(state, install);
          if (installed !== state) { state = installed; actions += 1; }
        } else notes.push(`第 ${state.week} 周监测不可开通（${reason}），本周执行贪心基线。`);
      }
      if (state.tech.scanned) {
        const plan = planWeek(state);
        expanded += plan.expanded;
        searchMs += plan.elapsedMs;
        for (const action of plan.actions) {
          const next = applyAction(state, action);
          if (next === state) { failure = `第 ${state.week} 周参考动作被引擎拒绝。`; break; }
          state = next;
          actions += 1;
        }
      } else {
        const greedy = playGreedyWeek(state);
        state = greedy.state; actions += greedy.actions;
      }
    } else {
      const greedy = playGreedyWeek(state);
      state = greedy.state; actions += greedy.actions;
    }
    if (failure) break;
    state = endWeek(state);
    weeks += 1;
    if (!state.ended) {
      const card = weekEvent(state);
      if (card) {
        const resolved = chooseEvent(state, card);
        if (!resolved) failure = `第 ${state.week} 周事件“${card.title}”没有可支付选项。`;
        else state = resolved;
      }
    }
  }
  if (!state.ended && !failure) failure = '自动策略超出十三次周结算上限。';
  if (failure) notes.push(failure);
  return { state, actions, expanded, elapsedMs: performance.now() - started, searchMs, failure, notes };
}

/** Fixed priority, bounded attempts; rejected actions never cause a retry loop. */
export function playGreedyWeek(origin: RunState): { state: RunState; actions: number } {
  let state = origin;
  let actions = 0;
  const usedCells = new Set<string>();
  for (const cell of state.pasture) if (pastureUse(state, cell) !== 'resting') usedCells.add(cell.id);
  const attempt = (action: Action) => {
    if (actionStatus(state, action).reason !== null) return false;
    const next = applyAction(state, action);
    if (next === state) return false;
    state = next;
    actions += 1;
    if (action.kind === 'graze' || action.kind === 'cut-hay') usedCells.add(action.cellId);
    return true;
  };

  attempt({ kind: 'vet' });
  const richest = [...state.pasture].filter(cell => !usedCells.has(cell.id))
    .sort((a, b) => b.biomassKgPerHa * b.areaHa - a.biomassKgPerHa * a.areaHa || a.id.localeCompare(b.id))[0];
  if (richest) attempt({ kind: 'graze', cellId: richest.id });

  const gap = Math.max(0, feedRequirementKg(state.animals.filter(a => a.alive)) - state.grazedKg - state.hayKg);
  if (gap > 0) {
    const price = hayPricePerKg(state.season, state.weather === 'blizzard');
    const affordable = Math.max(0, Math.floor(state.money / price));
    for (const kg of new Set([Math.ceil(gap / 100) * 100, Math.ceil(gap), affordable])) {
      if (kg > 0 && attempt({ kind: 'buy-hay', kg })) break;
    }
  }
  for (const cell of [...state.pasture].sort((a, b) => a.id.localeCompare(b.id))) {
    if (state.actionsLeft <= 0) break;
    if (!usedCells.has(cell.id)) attempt({ kind: 'cut-hay', cellId: cell.id });
  }
  return { state, actions };
}

function chooseEvent(state: RunState, card: EventCard): RunState | null {
  for (const choice of card.choices) {
    if (eventChoiceStatus(state, card.id, choice.id).reason !== null) continue;
    const next = resolveEvent(state, card.id, choice.id);
    if (next !== state) {
      const flag = `pending-event:${state.week}:${card.id}`;
      return state.flags[flag] ? { ...next, flags: { ...next.flags, [flag]: false } } : next;
    }
  }
  return null;
}

function pendingCard(state: RunState): EventCard | undefined {
  const prefix = `pending-event:${state.week}:`;
  for (const [flag, pending] of Object.entries(state.flags)) {
    if (pending && flag.startsWith(prefix)) {
      const card = findCard(flag.slice(prefix.length));
      if (card && !state.usedEvents.includes(card.id)) return card;
    }
  }
  return undefined;
}
