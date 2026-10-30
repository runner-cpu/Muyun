import { captureMetrics } from './history';
import { feedRequirementKg } from './nutrition';
import {
  MAX_CANDIDATES, MAX_EXPANDED_NODES, PLAN_PROFILES, PLANNER_VERSION,
  planWeek, SEARCH_DEPTH, SEARCH_WIDTH,
} from './planner';
import type { PlanResult, PlanningProfile } from './planner';
import { actionStatus, pastureUse } from './rules';
import { applyAction } from './run';
import { settleDeterministic } from './settlement';
import { SIM_VERSION } from './types';
import type { Action, ReplayOrigin, RunMetrics, RunState } from './types';

export const WEEK_EXPERIMENT_SCHEMA = 'muyun-week-experiment-v1';
export const MAX_EXPERIMENT_JSON_LENGTH = 2_000_000;
const PROFILES: readonly PlanningProfile[] = ['balanced', 'ecology', 'assets'];
export const WEEK_EXPERIMENT_LIMITATIONS = Object.freeze([
  '这是当前周的假设试算，不是已发生的经营记录；不会改变真实存档、行动点或历史。',
  '仅结算可见的饲喂、体况生长、草场恢复及维护费用；不抽取未来天气、事件、疫病或出生。',
  'F 为本周饲草覆盖率，E 为 1−平均退化，H 为当前起点下的健康评价，V 为当前起点下的净资产评价；E 不等于最终生态分。',
  '每种取向先优先足草且结算现金大于零的方案，再按各自权重排序；不同权重下的总分不能直接比较。',
  '有限宽度和候选动作的束搜索不保证全局最优，也不表示全局帕累托前沿；不同取向可能得到完全相同的行动。',
  '免疫的未来风险收益不在本周确定性模型内；结果不能证明真实牧场收益、教学效果或策略总能胜出。',
]);

export interface ExperimentProjection {
  metrics: RunMetrics;
  feedNeedKg: number;
  feedCoverage: number;
  feedGapKg: number;
  safe: boolean;
}

export interface ExperimentStep {
  index: number;
  action: Action;
  cost: number;
  income: number;
  /** Observed immediately after this hypothetical action, without settlement. */
  immediate: RunMetrics;
  /** Independently settles this prefix once; not added to the next prefix. */
  settled: RunMetrics;
  feedNeedKg: number;
  feedGapKg: number;
}

export interface ExperimentDelta {
  money: number;
  hayKg: number;
  netAssets: number;
  averageBcs: number;
  averageDegradation: number;
  grassKg: number;
  sheepUnits: number;
  feedGapKg: number;
}

export interface ExperimentPlan extends PlanResult {
  sameActionsAs: PlanningProfile | null;
  steps: ExperimentStep[];
  /** Difference from the same-current-state, no-action deterministic settlement. */
  delta: ExperimentDelta;
}

export interface WeekExperiment {
  plannerVersion: typeof PLANNER_VERSION;
  simulationVersion: typeof SIM_VERSION;
  /** Accidental stale-result guard; this checksum is not an authentication signature. */
  inputFingerprint: string;
  week: number;
  seed: number;
  lockedReason: string | null;
  baseline: ExperimentProjection | null;
  plans: ExperimentPlan[];
  totalExpanded: number;
}

export interface WeekExperimentExport {
  schema: typeof WEEK_EXPERIMENT_SCHEMA;
  plannerVersion: typeof PLANNER_VERSION;
  simulationVersion: typeof SIM_VERSION;
  source: { kind: 'hypothetical-current-week'; description: string };
  method: {
    search: 'beam-search';
    width: number;
    maximumDepth: number;
    maximumCandidates: number;
    maximumExpandedPerProfile: number;
    profiles: typeof PLAN_PROFILES;
    constraints: {
      availableActions: number;
      minimumRetainedSheepUnits: number;
      safeFeedGapToleranceKg: number;
      settlementCashMustBePositive: true;
      pastureUsesPerWeek: 1;
      canStopEarly: true;
    };
  };
  input: ReplayOrigin;
  output: WeekExperiment;
  limitations: readonly string[];
}

export interface WeekExperimentVerification {
  valid: boolean;
  reason: string;
  experiment?: WeekExperiment;
}

/** Independent alternatives from one observable state; never executes on the real run. */
export function compareWeekPlans(state: RunState): WeekExperiment {
  const input = experimentInput(state);
  const result: WeekExperiment = {
    plannerVersion: PLANNER_VERSION, simulationVersion: SIM_VERSION,
    inputFingerprint: fingerprint(input), week: input.week, seed: input.seed,
    lockedReason: null, baseline: null, plans: [], totalExpanded: 0,
  };
  if (input.ended || !input.tech.scanned) {
    result.lockedReason = planWeek(input).lockedReason;
    return result;
  }

  const baseline = project(input);
  result.baseline = baseline;
  const sequenceOwners = new Map<string, PlanningProfile>();
  result.plans = PROFILES.map(profile => {
    const plan = planWeek(input, profile);
    const key = JSON.stringify(plan.actions);
    const sameActionsAs = sequenceOwners.get(key) ?? null;
    if (!sameActionsAs) sequenceOwners.set(key, profile);
    return {
      ...plan, sameActionsAs, steps: actionSteps(input, plan.actions),
      delta: {
        money: plan.metrics.money - baseline.metrics.money,
        hayKg: plan.metrics.hayKg - baseline.metrics.hayKg,
        netAssets: plan.metrics.netAssets - baseline.metrics.netAssets,
        averageBcs: plan.metrics.averageBcs - baseline.metrics.averageBcs,
        averageDegradation: plan.metrics.averageDegradation - baseline.metrics.averageDegradation,
        grassKg: plan.metrics.grassKg - baseline.metrics.grassKg,
        sheepUnits: plan.metrics.sheepUnits - baseline.metrics.sheepUnits,
        feedGapKg: plan.feedGapKg - baseline.feedGapKg,
      },
    };
  });
  result.totalExpanded = result.plans.reduce((sum, plan) => sum + plan.expanded, 0);
  return result;
}

/** A separate hypothetical evidence file; never writes to RunExport or tracking. */
export function exportWeekExperiment(state: RunState, experiment: WeekExperiment): string {
  const input = experimentInput(state);
  if (experiment.inputFingerprint !== fingerprint(input)
    || experiment.plannerVersion !== PLANNER_VERSION || experiment.simulationVersion !== SIM_VERSION) {
    throw new Error('当前状态或试算版本已经变化，请重新运行本周策略实验后导出。');
  }
  return JSON.stringify(exportPayload(input, experiment), null, 2);
}

/** Bounded parsing and exact recomputation; elapsed wall time is the only ignored output. */
export function verifyWeekExperiment(serialized: unknown): WeekExperimentVerification {
  try {
    if (typeof serialized !== 'string') return invalid('请提供周策略实验的 JSON 文本。');
    if (serialized.length > MAX_EXPERIMENT_JSON_LENGTH) return invalid('实验文件过大，最多支持 200 万字符的 JSON 文本。');
    const payload: unknown = JSON.parse(serialized);
    validateJsonTree(payload);
    const record = object(payload, '实验文件');
    if (record.schema !== WEEK_EXPERIMENT_SCHEMA) return invalid('不支持的周策略实验文件版本。');
    if (record.simulationVersion !== SIM_VERSION || record.plannerVersion !== PLANNER_VERSION) {
      return invalid('模拟或规划器版本不同，不能保证准确复算。');
    }
    const input = validateInput(record.input);
    // Reject altered formulas/constraints before spending time on search.
    const manifest = exportPayload(input, undefined);
    const { output: providedOutput, ...providedManifest } = record;
    const { output: _output, ...expectedManifest } = manifest;
    if (canonical(providedManifest) !== canonical(expectedManifest)) {
      return invalid('实验元数据、约束或公开权重与当前版本不一致。');
    }
    const actual = compareWeekPlans(input);
    if (canonical(nonTimedOutput(providedOutput)) !== canonical(nonTimedOutput(actual))) {
      return invalid('试算结果与当前输入的复算不一致，文件可能已被修改。');
    }
    return { valid: true, reason: actual.lockedReason ? '复算通过：当前状态锁定，未执行搜索。'
      : '复算通过：基线、三种取向、逐步效果与全部非耗时结果一致。', experiment: actual };
  } catch (error) {
    return invalid(error instanceof SyntaxError ? '无法读取 JSON，请检查实验文件格式。'
      : error instanceof Error ? `无法验证：${error.message}` : '无法验证此实验文件。');
  }
}

function project(state: RunState): ExperimentProjection {
  const feedNeedKg = feedRequirementKg(state.animals.filter(animal => animal.alive));
  const available = state.hayKg + state.grazedKg;
  const feedGapKg = Math.max(0, feedNeedKg - available);
  const settled = settleDeterministic(state);
  return {
    metrics: captureMetrics(settled), feedNeedKg, feedGapKg,
    feedCoverage: feedNeedKg > 0 ? Math.max(0, Math.min(1, available / feedNeedKg)) : 1,
    safe: feedGapKg <= 1e-6 && settled.money > 0,
  };
}

function actionSteps(input: RunState, actions: Action[]): ExperimentStep[] {
  let current = input;
  return actions.map((action, index) => {
    const status = actionStatus(current, action);
    const next = applyAction(current, action);
    if (status.reason || next === current) throw new Error('参考方案包含不能执行的行动。');
    const projection = project(next);
    const step = {
      index: index + 1, action: JSON.parse(JSON.stringify(action)) as Action,
      cost: status.cost, income: Math.max(0, next.money - current.money),
      immediate: captureMetrics(next), settled: projection.metrics,
      feedNeedKg: projection.feedNeedKg, feedGapKg: projection.feedGapKg,
    };
    current = next;
    return step;
  });
}

/** Preserve pending pasture use without exporting recursive or real-run history. */
function experimentInput(state: RunState): ReplayOrigin {
  return {
    scenario: state.scenario ?? 'year', seed: state.seed, week: state.week, season: state.season,
    money: state.money, hayKg: state.hayKg, labor: state.labor, reputation: state.reputation,
    animals: state.animals.map(animal => ({ ...animal })),
    pasture: state.pasture.map(cell => {
      const use = pastureUse(state, cell);
      return { ...cell, grazing: use === 'grazed', harvested: use === 'cut',
        restedWeeks: use === 'resting' ? cell.restedWeeks : 0 };
    }),
    actionsLeft: state.actionsLeft, grazedKg: state.grazedKg, weather: state.weather,
    tech: { ...state.tech }, usedEvents: [], flags: {}, log: [], ended: state.ended, ending: state.ending,
  };
}

function exportPayload(input: ReplayOrigin, output: WeekExperiment | undefined): Omit<WeekExperimentExport, 'output'> & { output: WeekExperiment | undefined } {
  return {
    schema: WEEK_EXPERIMENT_SCHEMA, plannerVersion: PLANNER_VERSION, simulationVersion: SIM_VERSION,
    source: { kind: 'hypothetical-current-week', description: '从可见当前状态独立试算；不含真实经营轨迹和未来随机结果。' },
    method: {
      search: 'beam-search', width: SEARCH_WIDTH, maximumDepth: SEARCH_DEPTH,
      maximumCandidates: MAX_CANDIDATES, maximumExpandedPerProfile: MAX_EXPANDED_NODES,
      profiles: PLAN_PROFILES,
      constraints: {
        availableActions: Math.min(SEARCH_DEPTH, Math.max(0, Math.floor(input.actionsLeft))),
        minimumRetainedSheepUnits: captureMetrics(input).sheepUnits / 2,
        safeFeedGapToleranceKg: 1e-6, settlementCashMustBePositive: true,
        pastureUsesPerWeek: 1, canStopEarly: true,
      },
    },
    input, output, limitations: WEEK_EXPERIMENT_LIMITATIONS,
  };
}

function invalid(reason: string): WeekExperimentVerification { return { valid: false, reason }; }

function fingerprint(input: ReplayOrigin): string {
  const text = canonical(input);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function nonTimedOutput(value: unknown): Record<string, unknown> {
  const output = object(value, '实验结果');
  if (!Array.isArray(output.plans) || output.plans.length > 3) throw new Error('参考方案数量无效。');
  return { ...output, plans: output.plans.map(value => {
    const plan = object(value, '参考方案');
    number(plan.elapsedMs, '运行耗时', 0, 1e12);
    const { elapsedMs: _elapsedMs, ...rest } = plan;
    return rest;
  }) };
}

/** Stable JSON comparison after bounding the tree; only elapsedMs is excluded above. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function validateJsonTree(root: unknown): void {
  const pending = [{ value: root, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++visited > 60_000 || depth > 20) throw new Error('JSON 结构过大或嵌套过深。');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('JSON 包含非有限数值。');
    if (typeof value === 'string' && value.length > 16_000) throw new Error('JSON 文本字段过长。');
    if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length > 2_000) throw new Error('JSON 集合过大。');
      for (const [key, item] of entries) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('JSON 包含不支持的字段。');
        pending.push({ value: item, depth: depth + 1 });
      }
    }
  }
}

function validateInput(value: unknown): ReplayOrigin {
  const source = object(value, '试算输入');
  fields(source, ['scenario', 'seed', 'week', 'season', 'money', 'hayKg', 'labor', 'reputation', 'animals', 'pasture', 'actionsLeft', 'grazedKg', 'weather', 'tech', 'usedEvents', 'flags', 'log', 'ended', 'ending']);
  enumValue(source.scenario, ['year', 'winter-challenge-v1'], '场景');
  number(source.seed, 'seed', -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true);
  number(source.week, '周次', 1, 13, true);
  enumValue(source.season, ['spring', 'summer', 'autumn', 'winter'], '季节');
  number(source.money, '现金', 0, 1e9);
  number(source.hayKg, '干草', 0, 1e9);
  number(source.labor, '劳力', 0, 20, true);
  number(source.reputation, '声誉', 0, 100);
  number(source.actionsLeft, '行动点', 0, 5, true);
  number(source.grazedKg, '本周已采食草量', 0, 1e9);
  enumValue(source.weather, ['clear', 'wind', 'snow', 'blizzard'], '天气');
  boolean(source.ended, '结束状态');
  if (source.ending !== null) enumValue(source.ending, ['bankrupt', 'subsistence', 'well-off', 'cooperative', 'collapse'], '结局');
  const tech = object(source.tech, '科技');
  fields(tech, ['collared', 'vaccinated', 'scanned']);
  number(tech.collared, '项圈数量', 0, 1000, true);
  boolean(tech.vaccinated, '免疫状态');
  boolean(tech.scanned, '监测状态');
  if (!Array.isArray(source.animals) || source.animals.length > 1000) throw new Error('牲畜记录数量无效，最多支持 1000 条。');
  const animalIds = new Set<string>();
  source.animals.forEach(value => {
    const animal = object(value, '牲畜');
    fields(animal, ['id', 'tag', 'species', 'sex', 'ageWeeks', 'weightKg', 'bcs', 'health', 'pregnant', 'lactating', 'collar', 'alive'], ['exitReason', 'exitWeek']);
    const id = text(animal.id, '牲畜标识');
    if (animalIds.has(id)) throw new Error('牲畜标识重复。');
    animalIds.add(id);
    text(animal.tag, '耳标');
    enumValue(animal.species, ['yak', 'sheep'], '物种');
    enumValue(animal.sex, ['male', 'female'], '性别');
    enumValue(animal.health, ['healthy', 'subclinical', 'sick'], '健康状态');
    number(animal.ageWeeks, '畜龄', 0, 100_000, true);
    number(animal.weightKg, '体重', 0, 10_000);
    number(animal.bcs, '体况', 1, 5);
    for (const field of ['pregnant', 'lactating', 'collar', 'alive']) boolean(animal[field], field);
    if ('exitReason' in animal) enumValue(animal.exitReason, ['sold', 'death'], '离群原因');
    if ('exitWeek' in animal) number(animal.exitWeek, '离群周次', 1, 13, true);
  });
  if (!Array.isArray(source.pasture) || source.pasture.length > 4) throw new Error('草场小区数量无效，最多支持 4 区。');
  const pastureIds = new Set<string>();
  source.pasture.forEach(value => {
    const cell = object(value, '草场小区');
    fields(cell, ['id', 'areaHa', 'biomassKgPerHa', 'degradation', 'restedWeeks', 'grazing', 'harvested']);
    const id = text(cell.id, '草场标识');
    if (pastureIds.has(id)) throw new Error('草场标识重复。');
    pastureIds.add(id);
    number(cell.areaHa, '草场面积', 0.001, 10_000);
    number(cell.biomassKgPerHa, '草量密度', 0, 1e6);
    number(cell.degradation, '草场退化', 0, 1);
    number(cell.restedWeeks, '休牧周数', 0, 1e6, true);
    boolean(cell.grazing, '放牧状态');
    boolean(cell.harvested, '割草状态');
    if (cell.grazing && cell.harvested) throw new Error('草场不能同时放牧和割草。');
    if ((cell.grazing || cell.harvested) && cell.restedWeeks !== 0) throw new Error('已使用草场的休牧周数必须归零。');
  });
  if (!Array.isArray(source.usedEvents) || source.usedEvents.length
    || !Array.isArray(source.log) || source.log.length
    || Object.keys(object(source.flags, '事件标记')).length) {
    throw new Error('周试算输入应只包含当前状态，不应包含经营日志或事件轨迹。');
  }
  return source as unknown as ReplayOrigin;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}必须是对象。`);
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (required.some(key => !(key in value)) || Object.keys(value).some(key => !allowed.has(key))) throw new Error('试算输入缺少必要字段或包含不支持的字段。');
}
function number(value: unknown, label: string, min: number, max: number, integer = false): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${label}超出支持范围。`);
  }
}
function boolean(value: unknown, label: string): void {
  if (typeof value !== 'boolean') throw new Error(`${label}必须为布尔值。`);
}
function enumValue(value: unknown, values: string[], label: string): void {
  if (typeof value !== 'string' || !values.includes(value)) throw new Error(`${label}取值无效。`);
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.length || value.length > 128) throw new Error(`${label}长度无效。`);
  return value;
}
