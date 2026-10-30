import { gameState } from '../../core/GameState';
import { assessRun } from '../../sim/assessment';
import { reserveBudget } from '../../sim/reserves';
import type { RunState } from '../../sim/types';
import { ui } from '../instance';
import { escapeHtml, yuan } from './shared';

const SEASON = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
const kg = (value: number): string => `${Math.ceil(value).toLocaleString('zh-CN')} kg`;

export function reserveSummary(state: RunState): string {
  const budget = reserveBudget(state);
  if (!budget.weeks.length) return '本局已结束，查看实际经营成果。';
  return budget.firstStockGapWeek === null
    ? `仅按当前体重和库存，干草可覆盖接下来 ${budget.weeks.length} 次结算。`
    : `若后续不再放牧或收草，现有干草从第 ${budget.firstStockGapWeek} 周起不足。`;
}

export function reserveMarkup(state: RunState): string {
  const budget = reserveBudget(state);
  const assessment = assessRun(state);
  const baseline = state.tracking ? assessment.baseline : null;
  const retainedFloor = baseline ? baseline.sheepUnits * .5 : null;
  const seasonEnd = { spring: 3, summer: 6, autumn: 9, winter: 13 }[state.season];
  const checks: Array<[string, string, string, boolean]> = [
    ['经营分', assessment.economy.toFixed(1), '≥ 40', assessment.economy >= 40],
    ['生态分', assessment.ecology.toFixed(1), '≥ 60', assessment.ecology >= 60],
    ['健康分', assessment.health.toFixed(1), '≥ 70', assessment.health >= 70],
    ['保留羊单位', assessment.metrics.sheepUnits.toFixed(1), `≥ ${retainedFloor?.toFixed(1) ?? '—'}`, assessment.retainedShare >= .5],
    ['现金', yuan(state.money), '> ¥0', state.money > 0],
  ];
  return `<section class="reserve-section" aria-labelledby="reserve-heading">
    <h3 id="reserve-heading">${budget.weeks.length ? `储备看远${budget.weeks.length === 3 ? '三' : budget.weeks.length}周` : '本局储备结余'}</h3>
    <p class="reserve-summary">${escapeHtml(reserveSummary(state))}</p>
    <p class="modal-note">本季还需 ${state.ended ? 0 : seasonEnd - state.week + 1} 次结算，本局剩余 ${budget.remainingWeeks} 次。按现有人员与存活佩戴个体计算，每周固定支出 ${yuan(budget.fixedCost)}，到局末合计 ${yuan(budget.fixedCostsRemaining)}。</p>
    ${budget.weeks.length ? `<div class="decision-table-wrap" role="region" aria-label="三周储备账，可横向滚动" tabindex="0"><table class="data-table reserve-table">
      <caption>库存压力参照 · 当周放牧只抵扣当周需草</caption>
      <thead><tr><th scope="col">结算周次</th><th scope="col">需用干草</th><th scope="col">仅靠库存时缺口</th><th scope="col">假设补足的草费</th><th scope="col">固定费用</th></tr></thead>
      <tbody>${budget.weeks.map(week => `<tr><th scope="row">第 ${week.week} 周 · ${SEASON[week.season]}</th><td>${kg(week.hayNeedKg)}</td><td${week.stockGapKg > 0 ? ' class="danger-text"' : ''}>${kg(week.stockGapKg)}</td><td>${yuan(week.topUpCost)}</td><td>${yuan(week.fixedCost)}</td></tr>`).join('')}</tbody></table></div>
      <div class="reserve-total"><p>假设逐周补足整公斤干草，草费 ${yuan(budget.topUpTotal)} ＋ 固定费用 ${yuan(budget.fixedTotal)}</p><p class="${budget.cashAfterTopUp <= 0 ? 'danger-text' : ''}">${budget.cashAfterTopUp > 0 ? `当前现金结余 ${yuan(budget.cashAfterTopUp)}` : budget.cashAfterTopUp === 0 ? '当前现金恰好用完，无法保留现金结余' : `当前现金还差 ${yuan(-budget.cashAfterTopUp)}`}</p></div>` : ''}
    <details class="decision-method reserve-assumptions" open><summary>如何使用这份参照</summary><p>固定当前存栏、体重、人员与设备；包含当前需草量的 10% 损耗。未来不安排放牧、收草、买卖、治疗或其他投入，不模拟生长、繁殖、死亡、疫病与事件。放牧、轮休、收草和适度减载能改变这份账，需要你另行安排。</p><p>补草按各周季节价格计算；仅当前周计入已知暴雪涨价，未来天气未知。草费按每周整公斤购买、库存按结算规则取整。负现金只表示预算不足，不会自动购买或改变牧场，也不表示补给方案可执行；还需核对行动点。库存会降低缺草风险，不会降低暴雪概率。</p></details>
  </section>
  <section class="reserve-section" aria-labelledby="reserve-goals"><h3 id="reserve-goals">持续经营目标 · 当前距离</h3>
    ${baseline ? `<p class="modal-note">相对第 ${state.tracking!.origin.week} 周${state.tracking!.provenance === 'continued' ? '续玩' : '开局'}记录起点。以下是当前快照，最高成果在局末判断；三周现金参照也不等于经营分。</p>
    <dl class="reserve-goals">${checks.map(([label, current, target, met]) => `<div><dt>${label}</dt><dd><strong>${current}</strong><span>${target} · ${met ? '当前满足' : '尚未满足'}</span></dd></div>`).join('')}</dl>
    <p class="modal-note">保留目标固定参考记录起点，不能随每周出售逐步下调。当前${assessment.metrics.sheepUnits >= retainedFloor! ? `距离下限还余 ${(assessment.metrics.sheepUnits - retainedFloor!).toFixed(1)} 羊单位` : `距离下限还差 ${(retainedFloor! - assessment.metrics.sheepUnits).toFixed(1)} 羊单位`}；减载也要照顾这一目标。分数为游戏设计参数。</p>` : '<p class="modal-note">缺少可靠起点，当前只显示资源参照，不补造增长或保留目标。</p>'}
  </section>`;
}

export function openReservePanel(onBack: () => void): void {
  const root = ui.openModal({
    title: '三周储备账',
    subtitle: '先核对储备压力与持续成本，再安排本周行动。',
    body: `${reserveMarkup(gameState.run)}<div class="modal-actions"><button type="button" class="pixel-btn" id="reserve-back">返回经营面板</button></div>`,
  });
  root.querySelector('#reserve-back')?.addEventListener('click', onBack);
}
