import { gameState } from '../../core/GameState';
import { outbreakChance } from '../../sim/disease';
import { collarInsights, pastureInsights } from '../../sim/insights';
import { ui } from '../instance';
import { actFromPanel } from './panelActions';
import { actionControl, escapeHtml, panelStatus, percent, yuan } from './shared';
import { openStrategyPanel } from './strategy';

export function openTechPanel(): void {
  const root = ui.openModal({ title: '科技服务', subtitle: '了解实际效果与持续成本，再决定是否投入。', body: '' });

  const render = (): void => {
    const state = gameState.run;
    const animals = state.animals.filter((animal) => animal.alive);
    const herd = animals.length;
    const tech = state.tech;
    const collared = animals.filter(animal => animal.collar).length;
    const collarBatch = Math.min(10, herd - collared);
    const collars = collarInsights(state);
    const forecasts = tech.scanned ? pastureInsights(state) : [];
    const riskBefore = outbreakChance(herd, state.season, false);
    const riskAfter = outbreakChance(herd, state.season, true);
    root.innerHTML = `
      ${panelStatus(state)}
      <p class="panel-intro">免疫降低游戏中的疫情传入风险；项圈展示已佩戴个体的真实体况趋势；草场监测提供轮牧预测与策略试算。每项服务都有购置和持续成本。</p>
      <div class="tech-grid">
        <article class="tech-card ${tech.vaccinated ? 'owned' : ''}">
          <div class="tech-heading"><h3>全群免疫</h3><span class="status-label">${tech.vaccinated ? '本局已接种' : '可接种'}</span></div>
          <p>降低每周疫情传入的概率。本局有效，不需要每季重复接种。</p>
          <p class="modal-note">按当前存栏与季节估算，疫情传入概率从 ${percent(riskBefore)} 降至 ${percent(riskAfter)}。每周维护 ¥40。</p>
          ${actionControl(state, { kind: 'tech', tech: 'vaccine' }, tech.vaccinated ? '已完成接种' : '全群接种', 'id="tech-vaccine"')}
        </article>
        <article class="tech-card ${tech.collared > 0 ? 'owned' : ''}">
          <div class="tech-heading"><h3>智慧项圈</h3><span class="status-label">${collared} 头存栏已佩戴</span></div>
          <p>查看已佩戴个体的 BCS、相邻真实记录差值与偏瘦或患病关注项。这是游戏状态的虚拟监测，不提供真实定位或疾病诊断。</p>
          <p class="modal-note">每头购置 ¥180，每头每周维护 ¥3；按当前存活佩戴个体计费，本周 ${yuan(collared * 3)}。刚佩戴或没有前次记录时显示“首次记录”。</p>
          ${actionControl(state, { kind: 'tech', tech: 'collar' }, collarBatch > 0 ? `为 ${collarBatch} 头佩戴` : '暂无可新增佩戴个体', 'id="tech-collar"')}
          ${collars.length ? `<div class="decision-table-wrap" role="region" aria-label="项圈虚拟监测记录，可横向滚动" tabindex="0"><table class="data-table"><caption>已佩戴个体 · 最近真实记录的体况变化</caption><thead><tr><th scope="col">耳标</th><th scope="col">当前 BCS</th><th scope="col">记录变化</th><th scope="col">关注项</th></tr></thead><tbody>${collars.map(collar => `<tr><th scope="row">${escapeHtml(collar.tag)}</th><td>${collar.bcs.toFixed(2)}</td><td>${collar.delta === null ? '首次记录' : `${collar.delta > 0 ? '+' : ''}${collar.delta.toFixed(2)}`}</td><td>${escapeHtml(collar.risk)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="modal-note decision-empty-note">当前没有存活佩戴个体，佩戴后可在这里查看记录。</p>'}
        </article>
        <article class="tech-card ${tech.scanned ? 'owned' : ''}">
          <div class="tech-heading"><h3>草场监测</h3><span class="status-label">${tech.scanned ? '已开通' : '可开通'}</span></div>
          <p>比较各区现在放牧的采食、剩余草量与退化，以及休牧到下周的恢复；开通后可运行遵守真实现金与行动点限制的策略搜索。</p>
          <p class="modal-note">购置 ¥800、消耗 1 行动点，每周维护 ¥30。基础草量和饲草提醒始终可查看。以下试算不含未来随机天气、事件或疫病结果。</p>
          ${actionControl(state, { kind: 'tech', tech: 'scan' }, tech.scanned ? '已开通监测' : '开通草场监测', 'id="tech-scan"')}
          ${forecasts.length ? `<div class="decision-table-wrap" role="region" aria-label="草场放牧与休牧预测，可横向滚动" tabindex="0"><table class="data-table"><caption>按当前状态独立试算各区 · 草量单位 kg/ha</caption><thead><tr><th scope="col">小区</th><th scope="col">放牧采食 kg</th><th scope="col">放牧后草量</th><th scope="col">放牧后退化</th><th scope="col">休牧后草量</th><th scope="col">休牧后退化</th></tr></thead><tbody>${forecasts.map(forecast => `<tr><th scope="row">${escapeHtml(forecast.cellId)}</th><td>${Math.round(forecast.grazeKg).toLocaleString('zh-CN')}</td><td>${Math.round(forecast.biomassAfterGrazing).toLocaleString('zh-CN')}</td><td>${percent(forecast.degradationAfterGrazing)}</td><td>${Math.round(forecast.biomassAfterRest).toLocaleString('zh-CN')}</td><td>${percent(forecast.degradationAfterRest)}</td></tr>`).join('')}</tbody></table></div><div class="decision-inline-actions"><button type="button" class="pixel-btn primary" id="tech-strategy">打开本周策略试算</button></div>` : ''}
        </article>
      </div>`;
    root.querySelector('#tech-collar')?.addEventListener('click', () => actFromPanel({ kind: 'tech', tech: 'collar' }, ui, render));
    root.querySelector('#tech-vaccine')?.addEventListener('click', () => actFromPanel({ kind: 'tech', tech: 'vaccine' }, ui, render));
    root.querySelector('#tech-scan')?.addEventListener('click', () => actFromPanel({ kind: 'tech', tech: 'scan' }, ui, render));
    root.querySelector('#tech-strategy')?.addEventListener('click', () => openStrategyPanel(openTechPanel));
  };
  render();
}
