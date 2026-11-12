import { bus } from '../core/emitter';
import { gameState } from '../core/GameState';
import { reserveBudget } from '../sim/reserves';
import type { RunState } from '../sim/types';
import { escapeHtml, yuan } from './panels/shared';

type PressureStatus = '充足' | '偏紧' | '缺口';

export interface PressureFlowRow {
  week: number;
  hayNeedKg: number;
  availableKg: number;
  stockGapKg: number;
  stockAfterKg: number;
  stockShare: number;
  gapShare: number;
  fixedCost: number;
  fixedCostsThroughWeek: number;
  cashAfterFixed: number;
  fixedShare: number;
  status: PressureStatus;
}

/** Presentation of reserveBudget's stock-only path; never includes hypothetical top-ups. */
export function pressureFlowView(state: RunState) {
  const budget = reserveBudget(state);
  const hasHerd = state.animals.some(animal => animal.alive);
  let fixedCostsThroughWeek = 0;
  const rows: PressureFlowRow[] = budget.weeks.map(week => {
    fixedCostsThroughWeek += week.fixedCost;
    const availableKg = Math.max(0, week.hayNeedKg - week.stockGapKg);
    const cashAfterFixed = state.money - fixedCostsThroughWeek;
    // Source: reserveBudget.stockGapKg > 0 marks an actual stock-only shortage;
    // stockAfterKg is already rounded exactly as the reserve table's settlement path.
    // The table distinguishes positive cash from zero/negative cash. Apply those same
    // boundaries to fixed costs alone here, without its hypothetical hay purchases.
    // “偏紧” means exactly zero stock/cash surplus, never an invented percentage band.
    const status: PressureStatus = week.stockGapKg > 0 || cashAfterFixed < 0 ? '缺口'
      : (hasHerd && week.stockAfterKg === 0) || cashAfterFixed === 0 ? '偏紧' : '充足';
    return {
      week: week.week,
      hayNeedKg: week.hayNeedKg,
      availableKg,
      stockGapKg: week.stockGapKg,
      stockAfterKg: week.stockAfterKg,
      stockShare: week.hayNeedKg > 0 ? availableKg / week.hayNeedKg : 0,
      gapShare: week.hayNeedKg > 0 ? week.stockGapKg / week.hayNeedKg : 0,
      fixedCost: week.fixedCost,
      fixedCostsThroughWeek,
      cashAfterFixed,
      // This lane has its own currency scale. Kg and yuan never share a denominator.
      fixedShare: fixedCostsThroughWeek > 0
        ? fixedCostsThroughWeek / Math.max(fixedCostsThroughWeek, state.money) : 0,
      status,
    };
  });
  return { hasHerd, cash: state.money, rows };
}

const kg = (value: number): string => `${Math.ceil(value).toLocaleString('zh-CN')} kg`;
const width = (share: number): string => `${Math.max(0, Math.min(1, share)) * 100}%`;

export function pressureFlowMarkup(state: RunState): string {
  const view = pressureFlowView(state);
  const heading = '<div class="pressure-flow-heading"><h3 id="pressure-flow-heading">三周压力</h3><span>含本周 · 最多 3 次结算</span></div>';
  if (!view.rows.length) {
    return `<section class="pressure-flow" aria-labelledby="pressure-flow-heading">${heading}
      <p class="pressure-flow-empty">${state.ended ? '本局已结束，没有后续结算周次。' : '没有可显示的结算周次。'}可从详细储备账查看结余。</p></section>`;
  }
  return `<section class="pressure-flow" aria-labelledby="pressure-flow-heading">${heading}
    <p class="pressure-flow-method">仅用现有库存；固定费与现金单独计量。点任一行查看完整储备账。</p>
    ${view.hasHerd ? '' : '<p class="pressure-flow-empty">当前没有存活牲畜，无需饲草；人员与设备的固定费用仍会发生。</p>'}
    <div class="pressure-flow-legend" aria-hidden="true"><span><i class="pressure-flow-stock"></i>库存可供</span><span><i class="pressure-flow-gap"></i>饲草缺口</span><span><i class="pressure-flow-fixed"></i>固定费累占现款</span></div>
    <div class="pressure-flow-rows">${view.rows.map((row, index) => {
      const hayLabel = !view.hasHerd ? '无需饲草' : row.hayNeedKg === 0 ? '本周放牧已覆盖需草'
        : `库存可供 ${kg(row.availableKg)} / 需草 ${kg(row.hayNeedKg)}${row.stockGapKg > 0 ? ` · 缺 ${kg(row.stockGapKg)}` : ''}`;
      const cashLabel = `固定费累计 ${yuan(row.fixedCostsThroughWeek)} / 现款 ${yuan(view.cash)}`;
      const statusDetail = row.stockGapKg > 0 ? `饲草缺口 ${kg(row.stockGapKg)}`
        : row.cashAfterFixed < 0 ? `仅扣固定费，现金还差 ${yuan(-row.cashAfterFixed)}`
          : row.cashAfterFixed === 0 ? '仅扣固定费后无现金结余'
            : view.hasHerd && row.stockAfterKg === 0 ? '本次结算后没有干草余量'
              : view.hasHerd ? '饲草和固定费用均有结余' : '固定费用后现金仍有结余';
      return `<button type="button" class="pressure-flow-row" data-pressure-week="${row.week}" aria-label="${escapeHtml(`第 ${row.week} 周，${hayLabel}，${cashLabel}，${row.status}。${statusDetail}。查看三周储备账`)}">
        <span class="pressure-flow-week">第 ${row.week} 周<small>${index === 0 ? '本周' : index === 1 ? '下周' : '再下周'}</small></span>
        <span class="pressure-flow-lanes">
          ${row.hayNeedKg > 0 ? `<span class="pressure-flow-hay-bar" aria-hidden="true"><i class="pressure-flow-stock" style="width:${width(row.stockShare)}"></i><i class="pressure-flow-gap" style="width:${width(row.gapShare)}"></i></span>` : ''}
          <span class="pressure-flow-hay-label${row.stockGapKg > 0 ? ' danger-text' : ''}">${hayLabel}</span>
          <span class="pressure-flow-cost-bar" aria-hidden="true"><i class="pressure-flow-fixed" style="width:${width(row.fixedShare)}"></i></span>
          <span class="pressure-flow-cost-label${row.cashAfterFixed < 0 ? ' danger-text' : ''}">${cashLabel}</span>
        </span>
        <span class="pressure-flow-status" data-pressure-status="${row.status}" title="${escapeHtml(statusDetail)}">${row.status}</span>
      </button>`;
    }).join('')}</div>
    <p class="pressure-flow-footnote">固定当前畜群与体重，不新增放牧或收草；固定费不含补草费用。</p>
  </section>`;
}

/** Own the mounted component's notification and click lifetimes, including modal replacement. */
export function mountPressureFlow(host: HTMLElement, onDetail: (week: number) => void): () => void {
  let mounted = true;
  const render = (): void => {
    if (!mounted) return;
    const next = pressureFlowMarkup(gameState.run);
    if (host.innerHTML === next) return;
    const focusedWeek = host.querySelector<HTMLButtonElement>('[data-pressure-week]:focus')?.dataset.pressureWeek;
    host.innerHTML = next;
    if (focusedWeek) host.querySelector<HTMLButtonElement>(`[data-pressure-week="${focusedWeek}"]`)?.focus({ preventScroll: true });
  };
  const onClick = (event: Event): void => {
    const button = (event.target as HTMLElement | null)?.closest?.<HTMLButtonElement>('[data-pressure-week]');
    if (button && host.contains(button)) onDetail(Number(button.dataset.pressureWeek));
  };
  render();
  host.addEventListener('click', onClick);
  const unsubscribe = bus.on('state:changed', render);
  return () => {
    mounted = false;
    unsubscribe();
    host.removeEventListener('click', onClick);
  };
}
