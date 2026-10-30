import { mkdirSync, writeFileSync } from 'node:fs';
import { assessRun } from '../src/sim/assessment';
import { ensureTracking, replayOrigin } from '../src/sim/history';
import { MAX_CANDIDATES, MAX_EXPANDED_NODES, PLANNER_VERSION, SEARCH_DEPTH, SEARCH_WIDTH } from '../src/sim/planner';
import { policyOutcome, simulatePolicy } from '../src/sim/policies';
import { ASSESSMENT_FORMULA_VERSION } from '../src/sim/replay';
import { createRun } from '../src/sim/run';
import { createWinterChallenge } from '../src/sim/scenarios';
import { SIM_VERSION } from '../src/sim/types';
import type { PolicyId } from '../src/sim/policies';
import type { RunState, ScenarioId } from '../src/sim/types';

/** Published fixed input set: no seed selection based on the result. */
export const BENCHMARK_SEEDS = [
  20261001, 20261002, 20261003, 20261004, 20261005, 20261006,
  20261007, 20261008, 20261009, 20261010, 20261011, 20261012,
  20261013, 20261014, 20261015, 20261016, 20261017, 20261018,
  20261019, 20261020, 20261021, 20261022, 20261023, 20261024,
  20261025, 20261026, 20261027, 20261028, 20261029, 20261030,
] as const;

interface BenchmarkRow {
  seed: number;
  policy: PolicyId;
  ended: boolean;
  ending: string | null;
  economy: number;
  ecology: number;
  health: number;
  overall: number;
  netAssets: number;
  money: number;
  sheepUnits: number;
  aliveCount: number;
  averageBcs: number;
  averageDegradation: number;
  knownDeaths: number;
  births: number;
  actions: number;
  expanded: number;
  elapsedMs: number;
  searchMs: number;
  failed: boolean;
  completed: boolean;
  goalReached: boolean;
  eligible: boolean;
  retainedShare: number;
  retainedHalf: boolean;
  failure: string | null;
  notes: string[];
  settledWeeks: number;
}

function benchmark(scenario: ScenarioId, create: (seed: number) => RunState, filename: string) {
  const rows: BenchmarkRow[] = [];
  for (const seed of BENCHMARK_SEEDS) {
    for (const policy of ['greedy', 'search'] as const) {
      const run = simulatePolicy(create(seed), policy);
      const assessment = assessRun(run.state);
      const outcome = policyOutcome(run.state, run.failure, assessment);
      const m = assessment.metrics;
      rows.push({
        seed, policy, ended: run.state.ended, ending: run.state.ending,
        economy: assessment.economy, ecology: assessment.ecology, health: assessment.health,
        overall: assessment.overall, netAssets: m.netAssets, money: m.money,
        sheepUnits: m.sheepUnits, aliveCount: m.aliveCount, averageBcs: m.averageBcs,
        averageDegradation: m.averageDegradation, knownDeaths: assessment.knownDeaths, births: assessment.births,
        actions: run.actions, expanded: run.expanded, elapsedMs: run.elapsedMs, searchMs: run.searchMs,
        failed: Boolean(run.failure) || run.state.ending === 'bankrupt' || run.state.ending === 'collapse',
        ...outcome, eligible: assessment.eligible,
        failure: run.failure, notes: run.notes, settledWeeks: run.state.tracking?.weeks.length ?? 0,
      });
    }
  }

  const summary = (['greedy', 'search'] as const).map(policy => {
    const selected = rows.filter(row => row.policy === policy);
    const mean = (key: 'economy' | 'ecology' | 'health' | 'overall' | 'netAssets' | 'sheepUnits' | 'retainedShare' | 'elapsedMs' | 'searchMs' | 'expanded') => selected.reduce((sum, row) => sum + row[key], 0) / selected.length;
    const rate = (predicate: (row: BenchmarkRow) => boolean) => selected.filter(predicate).length / selected.length;
    return {
      scenario, policy, runs: selected.length, failureRate: selected.filter(r => r.failed).length / selected.length,
      completionRate: rate(row => row.completed), goalReachedRate: rate(row => row.goalReached),
      eligibleRate: rate(row => row.eligible), retentionMetRate: rate(row => row.retainedHalf),
      subsistenceRate: rate(row => row.ending === 'subsistence'),
      bankruptRate: rate(row => row.ending === 'bankrupt'), collapseRate: rate(row => row.ending === 'collapse'),
      engineFailureRate: rate(row => row.failure !== null),
      economy: mean('economy'), ecology: mean('ecology'), health: mean('health'), overall: mean('overall'),
      netAssets: mean('netAssets'), sheepUnits: mean('sheepUnits'), retainedShare: mean('retainedShare'), expanded: mean('expanded'),
      elapsedMs: mean('elapsedMs'), searchMs: mean('searchMs'),
    };
  });
  const columns: (keyof BenchmarkRow)[] = [
    'seed', 'policy', 'ended', 'ending', 'economy', 'ecology', 'health', 'overall', 'netAssets', 'money',
    'sheepUnits', 'aliveCount', 'averageBcs', 'averageDegradation', 'knownDeaths', 'births', 'actions', 'expanded',
    'elapsedMs', 'searchMs', 'failed', 'completed', 'goalReached', 'eligible', 'retainedShare', 'retainedHalf', 'failure', 'settledWeeks',
  ];
  mkdirSync('reports', { recursive: true });
  writeFileSync(`reports/${filename}.csv`, [columns.join(','), ...rows.map(row => columns.map(column => csv(row[column])).join(','))].join('\n') + '\n');
  writeFileSync(`reports/${filename}.json`, JSON.stringify({
    schema: 'muyun-strategy-benchmark-v2', simulationVersion: SIM_VERSION,
    plannerVersion: PLANNER_VERSION, assessmentFormulaVersion: ASSESSMENT_FORMULA_VERSION, scenario,
    seeds: BENCHMARK_SEEDS, beamWidth: SEARCH_WIDTH, maxDepth: SEARCH_DEPTH,
    maxCandidatesPerNode: MAX_CANDIDATES, maxExpandedPerProfile: MAX_EXPANDED_NODES,
    scenarioConfiguration: replayOrigin(create(BENCHMARK_SEEDS[0])),
    methodology: [
      '两策略使用相同场景和 seed；第一可玩周无额外事件，之后每次结算后处理新周事件。',
      '事件使用首个合法且可付款的选项；搜索真实支付监测购置、行动和维护。',
      '失败包括引擎执行失败、资金耗尽或生态失衡；所有失败案例保留。',
      '完成率仅表示引擎走完；达标率要求真实完局且 assessment.eligible 为真。零失败率不等于达标或取得高等级结局。',
      '留存比例和达标判断沿用 assessRun 的原始记录基线；每周试算保留当前存栏一半，不保证总局留存达标。',
      '场景配置给出第一个公开 seed 的完整平坦起点；其他 seed 仅替换 seed 后重新建立 tracking、baseline 与 replayOrigin。',
      '耗时为当前机器单次实测，非性能保证；结果仅评价本模拟，不证明真实牧场收益或教学效果。',
      ...(scenario === 'winter-challenge-v1' ? ['挑战实验沿用全部四周预设，仅变化公开 seed 后重新建立 tracking、baseline 与 replayOrigin；不作为游戏默认固定 seed 的改动。'] : []),
    ],
    summary, failures: rows.filter(row => row.failed), rows,
  }, null, 2) + '\n');
  console.table(summary);
  console.log(`${scenario}：${BENCHMARK_SEEDS.length} 个公开 seed、${rows.length} 次策略实验；输出 reports/${filename}.csv 与 .json。`);
  return summary;
}

function csv(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function challengeForSeed(seed: number): RunState {
  const { tracking: _tracking, ...preset } = createWinterChallenge();
  return ensureTracking({ ...preset, seed }, 'new-run');
}

benchmark('year', createRun, 'strategy-benchmark');
benchmark('winter-challenge-v1', challengeForSeed, 'strategy-benchmark-challenge');
