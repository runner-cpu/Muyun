import { gameState } from '../../core/GameState';
import { actionLimit } from '../../sim/rules';
import { seasonLabel } from '../../systems/Calendar';
import { ui } from '../instance';
import { escapeHtml, ranchSnapshot } from '../ranchView';
import { objectiveMarkup } from './reviewView';
import { openStrategyPanel } from './strategy';
import { openTechPanel } from './tech';
import { yuan } from './shared';
import { openPasturePanel } from './pasture';
import { openHerdPanel } from './herd';
import { openMarketPanel } from './market';
import { buildFieldNotes } from '../../sim/fieldnotes';
import { openFieldNotes } from './fieldnotes';
import { openReservePanel, reserveSummary } from './reserves';

const kg = (value: number): string => `${Math.ceil(value).toLocaleString('zh-CN')} kg`;

export function openOverviewPanel(): void {
  const run = gameState.run;
  const view = ranchSnapshot(run);
  const fieldnote = buildFieldNotes(run).notes[0];
  const seasons = [
    ['spring', '春', '1-3 周'], ['summer', '夏', '4-6 周'],
    ['autumn', '秋', '7-9 周'], ['winter', '冬', '10-13 周'],
  ];
  const risks: string[] = [];
  if (view.feedGapKg > 0) risks.push(`饲草缺口 ${kg(view.feedGapKg)}，结算时会影响体况与生长。`);
  if (view.sickCount > 0) risks.push(`${view.sickCount} 头牲畜患病，未经治疗可能传播或死亡。`);
  if (view.averageDegradation >= 0.3) risks.push('草场退化较高，未放牧、未收草的小区会自动休牧恢复。');
  if (view.cashAtRisk) risks.push(`本周人工与维护费 ${yuan(view.weeklyCost)}，结算后现金将耗尽。现金结余用于后续补给，也是局末持续经营目标之一。`);
  if (run.season === 'winter') risks.push('冬季草场恢复较慢，也可能出现暴雪损失，适合保留干草储备。');
  const logs = run.log.slice(-8).reverse();

  const root = ui.openModal({
    title: '本周概览',
    subtitle: `第 ${run.week} / 13 周 · ${seasonLabel(run.season)} · ${view.weatherLabel}`,
    body: `
      <div class="overview-feed ${view.feedTone}">
        <h3>${escapeHtml(view.headline)}</h3><p>${escapeHtml(view.hint)}</p>
      </div>
      <div class="overview-priorities"><button type="button" class="pixel-btn ${view.feedGapKg > 0 ? 'primary' : ''}" id="overview-pasture">安排草场</button><button type="button" class="pixel-btn ${view.sickCount > 0 ? 'primary' : ''}" id="overview-herd">${view.sickCount > 0 ? `照料 ${view.sickCount} 头患畜` : '查看畜群'}</button><button type="button" class="pixel-btn" id="overview-market">补草与交易</button></div>
      <ul class="overview-risk">${risks.length
        ? risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join('')
        : '<li>当前饲草充足，也没有患病牲畜。继续留意草场恢复和后续储备。</li>'}</ul>
      <h3 class="decision-heading">本周饲草与费用</h3>
      <dl class="overview-ledger overview-core-ledger">
        <div><dt>还需消耗干草</dt><dd>${kg(view.feedRequiredHayKg)}</dd></div>
        <div><dt>干草库存</dt><dd>${kg(run.hayKg)}</dd></div>
        <div><dt>本周人工与维护费</dt><dd>${yuan(view.weeklyCost)}</dd></div>
        <div><dt>可用现金</dt><dd>${yuan(run.money)}</dd></div>
      </dl>
      ${objectiveMarkup(run, true)}
      <details class="panel-disclosure" id="overview-feed-detail"><summary>饲喂计算与行动点</summary>
        <dl class="overview-ledger">
          <div><dt>本周总需草</dt><dd>${kg(view.feedNeedKg)}</dd></div>
          <div><dt>已通过放牧采食</dt><dd>${kg(view.grazedKg)}</dd></div>
          <div><dt>${view.feedGapKg > 0 ? '预计缺口' : '喂养后干草余量'}</dt><dd class="${view.feedGapKg > 0 ? 'danger-text' : ''}">${kg(view.feedGapKg > 0 ? view.feedGapKg : view.hayAfterFeedingKg)}</dd></div>
          <div><dt>剩余行动点 / 本周上限</dt><dd>${run.actionsLeft} / ${actionLimit(run)}</dd></div>
        </dl>
        <p class="modal-note">需草量已计入 10% 损耗。预估按当前畜群与草料计算，未计入结算时的随机天气与事件。</p>
      </details>
      <details class="panel-disclosure" id="overview-reference"><summary>三周储备、策略试算与高原手记</summary>
        <div class="panel-reference-row"><div><h3>把储备看远三周</h3><p>${escapeHtml(reserveSummary(run))} 同时核对现金、持续费用与存栏保留目标。</p></div><button type="button" class="pixel-btn" id="overview-reserves">查看三周储备账</button></div>
        <div class="panel-reference-row"><div><h3>${run.tech.scanned ? '比较本周的行动方案' : '开通监测后，可比较行动方案'}</h3><p>${run.tech.scanned ? '比较均衡、草场、资产三种偏好与不行动基线；查看行动依据，并导出可复算的本周实验单。' : '草场监测消耗 1 行动点、¥800，每周维护 ¥30；提供轮牧预测，并解锁策略试算。'}</p></div><button type="button" class="pixel-btn" id="overview-strategy">${run.tech.scanned ? '打开策略试算' : '查看监测与费用'}</button></div>
        <div class="panel-reference-row"><div><h3>高原手记 · ${escapeHtml(fieldnote.title)}</h3><p>${escapeHtml(fieldnote.observation)}</p></div><button type="button" class="pixel-btn" id="overview-fieldnotes">读懂草畜关系</button></div>
      </details>
      <details class="panel-disclosure" id="overview-history"><summary>四季进程与最近记录</summary>
      <ol class="season-track" aria-label="十三周季节进程">${seasons.map(([season, label, weeks]) => `
        <li ${season === run.season ? 'aria-current="step"' : ''}><b>${label}</b><span>${weeks}</span></li>`).join('')}</ol>
      <h3>最近记录</h3>
      <div class="overview-log">${logs.length
        ? logs.map((entry) => `<p class="log-${entry.tone === 'bad' ? 'bad' : entry.tone === 'good' ? 'good' : 'info'}"><span>第 ${entry.week} 周</span>${escapeHtml(entry.text)}</p>`).join('')
        : '<p class="empty-state">还没有经营记录，安排第一个行动后会出现在这里。</p>'}</div></details>`,
  });
  root.querySelector('#overview-pasture')?.addEventListener('click', () => openPasturePanel());
  root.querySelector('#overview-herd')?.addEventListener('click', () => openHerdPanel());
  root.querySelector('#overview-market')?.addEventListener('click', () => openMarketPanel());
  root.querySelector('#overview-fieldnotes')?.addEventListener('click', () => openFieldNotes(ui));
  root.querySelector('#overview-reserves')?.addEventListener('click', () => openReservePanel(openOverviewPanel));
  root.querySelector('#overview-strategy')?.addEventListener('click', () => {
    if (run.tech.scanned) openStrategyPanel(openOverviewPanel);
    else openTechPanel();
  });
}
