import { captureMetrics } from './history';
import type { Decision, RunState, Season, WeekRecord } from './types';

export interface SeasonObjective {
  season: Season;
  title: string;
  description: string;
  current: string;
  target: string;
  complete: boolean;
  status: 'active' | 'complete' | 'missed' | 'unrecorded';
}

const SEASONS: { season: Season; start: number; end: number; title: string; description: string; target: string }[] = [
  { season: 'spring', start: 1, end: 3, title: '春季 · 建立轮牧', description: '尝试不同放牧小区，控制春季草场透支。', target: '使用至少 2 个放牧区；平均退化 ≤ 0.30' },
  { season: 'summer', start: 4, end: 6, title: '夏季 · 留出恢复时间', description: '给草场连续休息的机会，保留后续经营余量。', target: '至少 1 区连续休牧 2 周；平均退化 ≤ 0.40' },
  { season: 'autumn', start: 7, end: 9, title: '秋季 · 准备越冬储备', description: '保留两周干草，并为下一周维护准备现金。', target: '干草 ≥ 当前畜群 2 周需草；现金 ≥ 下一周维护费' },
  { season: 'winter', start: 10, end: 13, title: '冬季 · 保住健康与经营', description: '维持体况，保留存栏，并保持现金为正。', target: '平均 BCS ≥ 2.5；存栏羊单位 ≥ 起点 50%；现金 > 0' },
];

/** Closed seasons read their real settlement; live state cannot rewrite a result. */
export function seasonObjectives(state: RunState): SeasonObjective[] {
  const metrics = captureMetrics(state);
  const baseline = state.tracking?.baseline ?? metrics;
  const definitions = state.scenario === 'winter-challenge-v1'
    ? SEASONS.filter(item => item.season === 'winter') : SEASONS;

  return definitions.map(definition => {
    const record = state.tracking?.weeks.find(item => item.week === definition.end);
    const elapsed = state.week > definition.end || (state.ended && state.week >= definition.end);
    const resultMetrics = record?.metrics ?? metrics;
    const decisions = seasonDecisions(state, definition.season, definition.start, definition.end, !record && !elapsed);
    const grazingCells = new Set(decisions.flatMap(decision => decision.kind === 'action' && decision.action.kind === 'graze'
      ? [decision.action.cellId] : [])).size;
    const restedCells = record ? restedCellsAt(state, definition.end) : state.pasture.filter(cell => cell.restedWeeks >= 2).length;
    const minimumUnits = baseline.sheepUnits * 0.5;
    const twoWeeksHay = resultMetrics.weeklyFeedKg * 2;
    let passed = false;
    let current = '';
    let recorded = Boolean(record);

    switch (definition.season) {
      case 'spring':
        passed = grazingCells >= 2 && resultMetrics.averageDegradation <= 0.3;
        current = `放牧 ${grazingCells} 区 · 平均退化 ${resultMetrics.averageDegradation.toFixed(2)}`;
        recorded &&= hasRecords(state, definition.start, definition.end);
        break;
      case 'summer':
        passed = (restedCells ?? 0) >= 1 && resultMetrics.averageDegradation <= 0.4;
        current = `连续休牧 ≥2 周 ${restedCells ?? 0} 区 · 平均退化 ${resultMetrics.averageDegradation.toFixed(2)}`;
        recorded &&= restedCells !== null;
        break;
      case 'autumn':
        passed = resultMetrics.hayKg >= twoWeeksHay && resultMetrics.money >= resultMetrics.weeklyCost;
        current = `干草 ${Math.round(resultMetrics.hayKg)} kg（需 ≥ ${Math.ceil(twoWeeksHay)}） · 现金 ${Math.round(resultMetrics.money)} 元（维护需 ${Math.round(resultMetrics.weeklyCost)}）`;
        recorded &&= Number.isFinite(twoWeeksHay) && Number.isFinite(resultMetrics.weeklyCost);
        break;
      case 'winter':
        passed = resultMetrics.averageBcs >= 2.5 && resultMetrics.sheepUnits >= minimumUnits
          && resultMetrics.aliveCount > 0 && resultMetrics.money > 0;
        current = `平均 BCS ${resultMetrics.averageBcs.toFixed(2)} · 存栏 ${formatUnits(resultMetrics.sheepUnits)} 羊单位（最低 ${formatUnits(minimumUnits)}） · 现金 ${Math.round(resultMetrics.money)} 元`;
        break;
    }

    const status: SeasonObjective['status'] = record
      ? recorded ? passed ? 'complete' : 'missed' : 'unrecorded'
      : elapsed ? 'unrecorded' : 'active';
    return {
      season: definition.season,
      title: definition.title,
      description: `${definition.description}${status === 'active' ? ` 距本季末结算还有 ${Math.max(0, definition.end - state.week + 1)} 周。` : ''}`,
      current: status === 'unrecorded' ? '未记录本季完整条件' : current,
      target: definition.target,
      complete: status === 'complete',
      status,
    };
  });
}

function seasonDecisions(state: RunState, season: Season, start: number, end: number, includePending: boolean): Decision[] {
  const recorded = (state.tracking?.weeks ?? [])
    .filter(record => record.season === season && record.week >= start && record.week <= end)
    .flatMap(record => record.decisions);
  return includePending && state.season === season ? [...recorded, ...(state.tracking?.pending ?? [])] : recorded;
}

function hasRecords(state: RunState, start: number, end: number): boolean {
  const weeks = new Set(state.tracking?.weeks.map(record => record.week));
  for (let week = start; week <= end; week++) if (!weeks.has(week)) return false;
  return true;
}

/** Rebuild only rest counters from the real origin and decisions, never a guessed past. */
function restedCellsAt(state: RunState, end: number): number | null {
  const tracking = state.tracking;
  if (!tracking || tracking.origin.week > end) return null;
  const counters = new Map(tracking.origin.pasture.map(cell => [cell.id, cell.restedWeeks]));
  const initialUse = new Set(tracking.origin.pasture.filter(cell => cell.grazing || cell.harvested).map(cell => cell.id));
  const records = new Map<number, WeekRecord>(tracking.weeks.map(record => [record.week, record]));
  for (let week = tracking.origin.week; week <= end; week++) {
    const record = records.get(week);
    if (!record) return null;
    const used = new Set(record.decisions.flatMap(decision => decision.kind === 'action' && (decision.action.kind === 'graze' || decision.action.kind === 'cut-hay')
      ? [decision.action.cellId] : []));
    if (week === tracking.origin.week) for (const cellId of initialUse) used.add(cellId);
    for (const [id, count] of counters) counters.set(id, used.has(id) ? 0 : count + 1);
  }
  return [...counters.values()].filter(count => count >= 2).length;
}

function formatUnits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
