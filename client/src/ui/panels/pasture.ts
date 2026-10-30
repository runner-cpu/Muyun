import { gameState } from '../../core/GameState';
import { carryingCapacitySheepUnits, totalBiomassKg } from '../../sim/pasture';
import { pastureInsights } from '../../sim/insights';
import { actionStatus, pastureUse } from '../../sim/rules';
import { ui } from '../instance';
import { actFromPanel } from './panelActions';
import { actionControl, escapeHtml, meter, percent } from './shared';
import { openStrategyPanel } from './strategy';
import { openTechPanel } from './tech';
import { ranchSnapshot } from '../ranchView';

export function openPasturePanel(focusCellId?: string): void {
  let focus = focusCellId;
  const root = ui.openModal({ title: '草场安排', subtitle: '四块草场，每区每周选择一次：放牧、收草，或留出恢复时间。', body: '' });

  const render = (): void => {
    const state = gameState.run;
    const cells = state.pasture;
    const view = ranchSnapshot(state);
    const forecasts = state.tech.scanned ? pastureInsights(state) : [];
    const lowerImpact = [...forecasts]
      .filter(item => item.canUse && item.grazeKg > 0 && !actionStatus(state, { kind: 'graze', cellId: item.cellId }).reason)
      .sort((a, b) => a.degradationAfterGrazing - b.degradationAfterGrazing || b.grazeKg - a.grazeKg)[0];
    const cards = cells.map((cell) => {
      const capacity = carryingCapacitySheepUnits(cell);
      const use = pastureUse(state, cell);
      const status = use === 'grazed' ? '本周已放牧' : use === 'cut' ? '本周已收草' : '留作休牧';
      const biomass = cell.biomassKgPerHa * cell.areaHa;
      const cut = Math.round(biomass * 0.1);
      const forecast = forecasts.find(item => item.cellId === cell.id);
      const grazingReason = actionStatus(state, { kind: 'graze', cellId: cell.id }).reason;
      return `<article class="cell-card pasture-card ${cell.id === focus ? 'focus' : ''}" data-use="${use}">
        <div class="pasture-card-heading"><h3>${escapeHtml(cell.id)} <small>区 · ${cell.areaHa} ha</small></h3><span class="status-label">${status}</span></div>
        <div class="pasture-grass"><strong>${Math.round(biomass).toLocaleString('zh-CN')}</strong><span>kg 现存草量</span></div>
        <dl class="pasture-facts"><div><dt>草场退化</dt><dd>${meter(cell.degradation, 1, cell.degradation > 0.5 ? 'warn' : '')} ${percent(cell.degradation)}</dd></div><div><dt>估算承载</dt><dd>${Math.round(capacity)} 羊单位/周</dd></div></dl>
        <p class="pasture-recovery">${use === 'resting' ? `已连续休牧 ${cell.restedWeeks} 周。${cell.restedWeeks >= 2 ? '继续休牧，结算时退化最多降 1 个百分点，最低为 0。' : `再休牧 ${Math.max(0, 2 - cell.restedWeeks)} 周后，下次休牧开始降低退化。`}` : '本周已使用，休牧计数归零；下周可重新安排。'}</p>
        <div class="cell-actions">
          ${actionControl(state, { kind: 'graze', cellId: cell.id }, '安排放牧', `data-graze="${escapeHtml(cell.id)}"`, '1 行动点 · 抵扣本周需草')}
          ${actionControl(state, { kind: 'cut-hay', cellId: cell.id }, '收割干草', `data-cut="${escapeHtml(cell.id)}"`, `1 行动点 · 收草 ${cut} kg 入库`)}
        </div>
        ${forecast && use === 'resting' ? `<details class="decision-cell-forecast"><summary>监测对照${lowerImpact?.cellId === cell.id ? ' · 放牧后退化较低' : ''}</summary>${!grazingReason ? `<p>现在放牧：采食 <b>${Math.round(forecast.grazeKg).toLocaleString('zh-CN')} kg</b>，即时余草 ${Math.round(forecast.biomassAfterGrazing * cell.areaHa).toLocaleString('zh-CN')} kg，退化 ${percent(forecast.degradationAfterGrazing)}。</p>` : `<p>${escapeHtml(grazingReason ?? '本周暂不可放牧。')}</p>`}<p>继续休牧至下周：草量 <b>${Math.round(forecast.biomassAfterRest * cell.areaHa).toLocaleString('zh-CN')} kg</b>，退化 ${percent(forecast.degradationAfterRest)}。</p></details>` : ''}
      </article>`;
    }).join('');

    root.innerHTML = `
      <div class="pasture-weekly ${view.feedTone}"><div><span>第 ${state.week} 周 · 饲草安排</span><h3>${escapeHtml(view.headline)}</h3></div><p>放牧已采食 ${Math.ceil(view.grazedKg).toLocaleString('zh-CN')} kg<br />库存干草 ${Math.ceil(state.hayKg).toLocaleString('zh-CN')} kg</p></div>
      <div class="pasture-plan-summary"><span>四区总草量 <b>${Math.round(totalBiomassKg(cells)).toLocaleString('zh-CN')} kg</b></span><span>留作休牧 <b>${cells.filter(cell => pastureUse(state, cell) === 'resting').length} / ${cells.length} 区</b></span><span>剩余 <b>${state.actionsLeft} 行动点</b></span></div>
      <p class="modal-note pasture-rule">每区每周用一次；放牧、收草都会中断休牧。未使用区周末自动恢复。</p>
      ${cards ? `<div class="cell-grid">${cards}</div>` : '<div class="empty-state"><h3>暂无可用草场</h3><p>可在集市购买干草满足本周饲草需求。</p></div>'}
      <div class="decision-context-action"><div><h3>${state.tech.scanned ? '把四区安排放在一起比较' : '了解草场监测'}</h3><p>${state.tech.scanned ? '试算会同时考虑需草、草场退化、现金和行动点。' : '开通后查看放牧与休牧预测：1 行动点、¥800，每周维护 ¥30。'}</p></div><button type="button" class="pixel-btn" id="pasture-insights">${state.tech.scanned ? '比较本周策略' : '查看监测服务'}</button></div>
      <details class="decision-method"><summary>草场恢复与预测口径</summary><p>连续完成两周休牧后，第三次休牧结算起每周最多降低退化 1 个百分点，最低为 0。草量增长随季节变化。放牧和收割会重置连续休牧计数。</p><p>羊单位用于比较草场压力；实际喂养需草按体重干物质计算。各区预测为独立模拟，不含未来随机结果，采食量不能直接相加。“退化较低”按可执行区的放牧后退化比较，仍需结合饲草缺口选择。</p></details>`;
    root.querySelector('#pasture-insights')?.addEventListener('click', () => {
      if (state.tech.scanned) openStrategyPanel(() => openPasturePanel(focus));
      else openTechPanel();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-graze]').forEach((button) => {
      button.addEventListener('click', () => { focus = button.dataset.graze; actFromPanel({ kind: 'graze', cellId: focus! }, ui, render); });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-cut]').forEach((button) => {
      button.addEventListener('click', () => { focus = button.dataset.cut; actFromPanel({ kind: 'cut-hay', cellId: focus! }, ui, render); });
    });
  };
  render();
}
