import { assessRun } from '../../sim/assessment';
import { findCard } from '../../sim/events';
import { seasonObjectives } from '../../sim/objectives';
import { pastureUse } from '../../sim/rules';
import type { Action, Decision, RunMetrics, RunState, Season } from '../../sim/types';
import { escapeHtml, percent, yuan } from './shared';

const SEASONS: Record<Season, string> = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
const OBJECTIVE_STATUS = { active: '进行中', complete: '已达成', missed: '未达成', unrecorded: '未记录' };
export const formatKg = (value: number): string => `${Math.round(value).toLocaleString('zh-CN')} kg`;

export function actionDescription(state: RunState, action: Action): string {
  switch (action.kind) {
    case 'graze': return `${action.cellId} 区放牧`;
    case 'cut-hay': return `${action.cellId} 区收割干草`;
    case 'buy-hay': return `购买 ${formatKg(action.kg)} 干草`;
    case 'vet': return '请兽医治疗患病个体';
    case 'breed': return '安排符合条件的母畜配种';
    case 'hire': return '雇用一名帮工';
    case 'tech': return action.tech === 'scan' ? '开通草场监测' : action.tech === 'vaccine' ? '全群免疫' : '为牲畜佩戴项圈';
    case 'sell': {
      const tags = action.animalIds.map(id => state.animals.find(animal => animal.id === id)?.tag ?? id);
      return `出售 ${tags.length} 头：${tags.join('、')}`;
    }
  }
}

export function objectiveMarkup(state: RunState, currentOnly = false): string {
  const objectives = seasonObjectives(state).filter(objective => !currentOnly || objective.season === state.season);
  return `<div class="decision-objectives">${objectives.length ? objectives.map(objective => `
    <article class="decision-objective" data-status="${objective.status}">
      <div class="decision-section-title"><h3>${escapeHtml(SEASONS[objective.season])}使命 · ${escapeHtml(objective.title.replace(/^[春夏秋冬]季\s*·\s*/, ''))}</h3><span class="status-label">${OBJECTIVE_STATUS[objective.status]}</span></div>
      <p>${escapeHtml(objective.description)}</p>
      <dl class="decision-facts"><div><dt>当前记录</dt><dd>${escapeHtml(objective.current)}</dd></div><div><dt>达成条件</dt><dd>${escapeHtml(objective.target)}</dd></div></dl>
    </article>`).join('') : '<p class="empty-state">这个场景没有当前季节的使命记录。</p>'}</div>`;
}

export function baselineDescription(state: RunState): string {
  if (!state.tracking) return '当前没有可靠的开局基准；这里只展示原始状态，不补造历史增长。';
  const start = state.tracking.origin.week;
  return state.tracking.provenance === 'continued'
    ? `评价基准为第 ${start} 周的本次续玩起点；之前的经营与损失未记录。`
    : `评价基准为${state.scenario === 'winter-challenge-v1' ? '第 10 周挑战给定配置' : '第 1 周开局配置'}，畜群与干草按固定冬季价格估值。`;
}

export function assessmentMarkup(state: RunState): string {
  const assessment = assessRun(state);
  const metrics = assessment.metrics;
  const baseline = state.tracking ? assessment.baseline : null;
  const economyScore = baseline ? assessment.economy.toFixed(0) : '—';
  const growth = baseline && baseline.netAssets > 0 ? (metrics.netAssets / baseline.netAssets - 1) * 100 : null;
  const dimensions = [
    ['经营', economyScore, `净资产 ${yuan(metrics.netAssets)}`, growth === null ? '缺少可靠增长基准' : `相对记录起点 ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`],
    ['生态', baseline ? assessment.ecology.toFixed(0) : '—', `草场退化 ${percent(metrics.averageDegradation)}`, `现存草量 ${formatKg(metrics.grassKg)}`],
    ['动物健康', baseline ? assessment.health.toFixed(0) : '—', `平均 BCS ${metrics.averageBcs.toFixed(2)}`, `健康 ${metrics.healthyCount} / 存栏 ${metrics.aliveCount} 头`],
  ];
  return `<div class="decision-table-wrap" role="region" aria-label="三维经营成果" tabindex="0"><table class="data-table decision-score-table">
    <caption>三维成果 · 游戏设计评分（0–100）</caption><thead><tr><th scope="col">评价维度</th><th scope="col">评分</th><th scope="col">原始指标</th><th scope="col">依据</th></tr></thead>
    <tbody>${dimensions.map(([label, score, metric, detail]) => `<tr><th scope="row">${label}</th><td class="decision-score">${score}</td><td>${metric}</td><td>${detail}</td></tr>`).join('')}</tbody></table></div>
    <p class="decision-outcome">${baseline ? `综合成果 <strong>${assessment.overall.toFixed(0)} / 100</strong>。` : ''}${baseline && assessment.eligible ? '已满足最高成果的持续经营条件。' : '最高成果需要经营 ≥40、生态 ≥60、健康 ≥70，保留至少一半开局羊单位，并有现金结余。'}</p>
    <dl class="overview-ledger decision-result-ledger">
      <div><dt>现金</dt><dd>${yuan(metrics.money)}</dd></div><div><dt>干草库存</dt><dd>${formatKg(metrics.hayKg)}</dd></div>
      <div><dt>存栏羊单位</dt><dd>${metrics.sheepUnits.toFixed(1)}</dd></div><div><dt>畜群估值</dt><dd>${yuan(metrics.herdValue)}</dd></div>
      <div><dt>记录内已知死亡</dt><dd>${baseline ? `${assessment.knownDeaths} 头` : '未记录'}</dd></div><div><dt>记录内出生</dt><dd>${baseline ? `${assessment.births} 头` : '未记录'}</dd></div>
    </dl><p class="modal-note">${escapeHtml(baselineDescription(state))} 评分及使命阈值用于本游戏，不是农牧行业标准。</p>`;
}

function decisionDescription(state: RunState, decision: Decision): string {
  if (decision.kind === 'action') return actionDescription(state, decision.action);
  const card = findCard(decision.cardId);
  const choice = card?.choices.find(item => item.id === decision.choiceId);
  return `事件：${card?.title ?? decision.cardId} · ${choice?.label ?? decision.choiceId}`;
}

/** Read the actual current-week ledger; visiting a panel never completes a task. */
export function currentWeekMarkup(state: RunState): string {
  const pending = state.tracking?.pending ?? [];
  const actions = pending.filter(item => item.kind === 'action');
  const resting = state.pasture.filter(cell => pastureUse(state, cell) === 'resting').map(cell => cell.id);
  return `<details class="panel-disclosure" id="overview-current-actions"><summary>本周已记录 ${actions.length} 次经营 · 剩余 ${state.actionsLeft} 行动</summary>
    ${pending.length ? `<ol class="decision-record-actions">${pending.map(item => `<li>${escapeHtml(decisionDescription(state, item))}</li>`).join('')}</ol>` : '<p>当前记录区间内，本周还没有执行经营行动。查看面板或运行试算都不算实际行动。</p>'}
    <p>${resting.length ? `${escapeHtml(resting.join('、'))} 尚未利用；本周继续不放牧、不割草，就会在结算时休牧恢复。` : '四块草场本周都已利用，下周才能再次安排。'}</p>
    <p class="modal-note">${state.tracking?.provenance === 'continued' ? '从本次续玩记录起点显示，不补造此前选择。' : ''}不用花完行动点；先核对缺草、患病和现金，再决定是否结算。剩余行动点不会结转。</p>
  </details>`;
}

export function weekHistoryMarkup(state: RunState): string {
  const weeks = state.tracking?.weeks ?? [];
  if (!weeks.length) return '<p class="empty-state">尚无已结算周记录。旧档未记录的周次不会补造。</p>';
  const cells = (metrics: RunMetrics): string => `<td>${yuan(metrics.money)}</td><td>${formatKg(metrics.hayKg)}</td><td>${yuan(metrics.netAssets)}</td><td>${metrics.aliveCount}</td><td>${metrics.averageBcs.toFixed(2)}</td><td>${formatKg(metrics.grassKg)}</td><td>${percent(metrics.averageDegradation)}</td>`;
  return `<p class="modal-note">以下为真实周结算记录；点击每周的选择可查看行动与事件。表格可横向滚动。</p>
    <div class="decision-table-wrap" role="region" aria-label="逐周经营记录，可横向滚动" tabindex="0"><table class="data-table decision-history-table">
    <caption>第 ${weeks[0].week}–${weeks.at(-1)!.week} 周已结算轨迹</caption>
    <thead><tr><th scope="col">周次</th><th scope="col">现金</th><th scope="col">干草</th><th scope="col">净资产</th><th scope="col">存栏</th><th scope="col">BCS</th><th scope="col">草量</th><th scope="col">退化</th><th scope="col">本周选择</th></tr></thead>
    <tbody>${weeks.map(week => `<tr><th scope="row">${week.week} · ${SEASONS[week.season]}</th>${cells(week.metrics)}<td>${week.decisions.length ? `<details><summary>${week.decisions.length} 项选择</summary><ol class="decision-record-actions">${week.decisions.map(decision => `<li>${escapeHtml(decisionDescription(state, decision))}</li>`).join('')}</ol></details>` : '休整，无已记录选择'}</td></tr>`).join('')}</tbody></table></div>`;
}

export function comparisonMetricsMarkup(metrics: RunMetrics): string {
  return `<td>${yuan(metrics.netAssets)}</td><td>${metrics.aliveCount}</td><td>${metrics.averageBcs.toFixed(2)}</td><td>${percent(metrics.averageDegradation)}</td>`;
}
