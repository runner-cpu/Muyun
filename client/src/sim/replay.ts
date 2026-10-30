import { assessRun } from './assessment';
import { captureMetrics, ensureTracking, replayOrigin } from './history';
import { applyAction, endWeek, resolveEvent } from './run';
import { SIM_VERSION } from './types';
import type { Decision, ReplayOrigin, RunMetrics, RunState, RunTracking, WeekRecord } from './types';

export const RUN_EXPORT_SCHEMA = 'muyun-run-v1';
export const ASSESSMENT_FORMULA_VERSION = 'decision-assessment-v1';

export interface RunExport {
  schema: typeof RUN_EXPORT_SCHEMA;
  simulationVersion: string;
  assessmentFormulaVersion: string;
  source: {
    kind: 'recorded-run' | 'snapshot';
    provenance: RunTracking['provenance'];
    fromWeek: number;
    toWeek: number;
    description: string;
  };
  scenario: { id: NonNullable<RunState['scenario']>; configuration: ReplayOrigin };
  seed: number;
  replayOrigin: ReplayOrigin;
  baseline: RunMetrics;
  weeks: WeekRecord[];
  pending: Decision[];
  result: {
    ended: boolean;
    ending: RunState['ending'];
    metrics: RunMetrics;
    assessment: ReturnType<typeof assessRun>;
  };
}

/** Restore the real recorded start, preserving the recorded assessment baseline. */
export function restoreRunOrigin(state: RunState): RunState {
  const tracking = ensureTracking(state).tracking!;
  return restore(tracking.origin, tracking.baseline, tracking.provenance, tracking.version);
}

/** A final-week origin can be playable even when its week equals the end week. */
export function hasRecordedInterval(tracking: RunTracking, currentWeek: number): boolean {
  return !tracking.origin.ended && tracking.weeks.some(record =>
    record.week >= tracking.origin.week && record.week <= currentWeek);
}

/** JSON contains one flat origin, recorded decisions, and observed results. */
export function exportRun(state: RunState): string {
  const tracked = ensureTracking(state);
  const tracking = tracked.tracking!;
  const snapshotOnly = tracking.origin.ended || (state.ended && !hasRecordedInterval(tracking, state.week));
  const origin = replayOrigin(snapshotOnly ? state : tracking.origin);
  const payload: RunExport = {
    schema: RUN_EXPORT_SCHEMA,
    simulationVersion: tracking.version || SIM_VERSION,
    assessmentFormulaVersion: ASSESSMENT_FORMULA_VERSION,
    source: {
      kind: snapshotOnly ? 'snapshot' : 'recorded-run',
      provenance: tracking.provenance, fromWeek: origin.week, toWeek: state.week,
      description: snapshotOnly ? '仅当前状态快照；无可玩历史起点和可验证的经营区间，不能重跑本局或生成策略对照。'
        : tracking.provenance === 'new-run' ? '从实际开局记录；仅导出真实发生的行动与周结算。' : '从本次续玩起点记录；起点之前的行动和周轨迹缺失。',
    },
    scenario: { id: origin.scenario ?? 'year', configuration: origin },
    seed: origin.seed, replayOrigin: origin, baseline: tracking.baseline,
    weeks: tracking.weeks, pending: tracking.pending,
    result: { ended: state.ended, ending: state.ending, metrics: captureMetrics(state), assessment: assessRun(tracked) },
  };
  return JSON.stringify(payload, null, 2);
}

/** Re-executes recorded decisions, or restores an explicitly labelled snapshot. */
export function replayRun(serialized: string | RunExport): RunState {
  const payload = typeof serialized === 'string' ? JSON.parse(serialized) as RunExport : serialized;
  if (payload.schema !== RUN_EXPORT_SCHEMA) throw new Error('不支持的经营记录版本。');
  if (payload.simulationVersion !== SIM_VERSION) throw new Error('模拟版本不同，不能保证准确重放。');
  if (payload.assessmentFormulaVersion !== ASSESSMENT_FORMULA_VERSION) throw new Error('评价公式版本不同，不能保证准确重放。');
  const source = payload.source;
  if (!source || !['snapshot', 'recorded-run'].includes(source.kind)
    || !['new-run', 'continued'].includes(source.provenance)) throw new Error('经营记录来源声明无效。');
  const origin = payload.replayOrigin;
  if (payload.seed !== origin.seed || source.fromWeek !== origin.week
    || payload.scenario.id !== (origin.scenario ?? 'year')
    || !sameJson(payload.scenario.configuration, origin)) throw new Error('场景、seed 或记录起点声明不一致。');
  if (!sameJson(payload.baseline, captureMetrics(origin))) throw new Error('评价基线与记录起点不一致。');
  let state = restore(payload.replayOrigin, payload.baseline, payload.source.provenance, payload.simulationVersion);
  for (const record of payload.source.kind === 'snapshot' ? [] : payload.weeks) {
    if (state.ended || state.week !== record.week) throw new Error(`第 ${record.week} 周记录与重放进度不一致。`);
    for (const decision of record.decisions) state = executeDecision(state, decision);
    state = endWeek(state);
    const actual = state.tracking!.weeks.at(-1)!.metrics;
    if (!sameJson(actual, record.metrics)) throw new Error(`第 ${record.week} 周指标与当前模拟不一致。`);
  }
  for (const decision of payload.source.kind === 'snapshot' ? [] : payload.pending) state = executeDecision(state, decision);
  if (!sameJson(captureMetrics(state), payload.result.metrics)) {
    throw new Error('记录结果与重放结果不一致。');
  }
  const snapshotOnly = state.tracking!.origin.ended || (state.ended && !hasRecordedInterval(state.tracking!, state.week));
  if (source.toWeek !== state.week || source.kind !== (snapshotOnly ? 'snapshot' : 'recorded-run')) {
    throw new Error('记录区间或快照声明与重放结果不一致。');
  }
  if (payload.result.ended !== state.ended || payload.result.ending !== state.ending) {
    throw new Error('结束状态或结局声明与重放结果不一致。');
  }
  if (!sameJson(payload.result.assessment, assessRun(state))) throw new Error('评价结果与当前公式的重算不一致。');
  return state;
}

/** JSON object key order is not part of the recorded evidence. */
function sameJson(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'undefined';
  };
  return canonical(left) === canonical(right);
}

function executeDecision(state: RunState, decision: Decision): RunState {
  const next = decision.kind === 'action'
    ? applyAction(state, decision.action)
    : resolveEvent(state, decision.cardId, decision.choiceId);
  if (next === state) throw new Error(`第 ${state.week} 周存在不能执行的已记录选择。`);
  return next;
}

function restore(origin: ReplayOrigin, baseline: RunMetrics, provenance: RunTracking['provenance'], version: string): RunState {
  const clean = replayOrigin(origin);
  return {
    ...clean,
    tracking: { version, provenance, origin: replayOrigin(clean), baseline: { ...baseline }, weeks: [], pending: [] },
  };
}
