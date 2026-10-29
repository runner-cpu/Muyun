import { gameState } from '../../core/GameState';
import { techCost } from '../../sim/economy';
import { ui } from '../instance';
import { percent, yuan } from './shared';

export function openTechPanel(): void {
  const herd = gameState.animals.filter((animal) => animal.alive).length;
  const tech = gameState.run.tech;
  const collarBatch = Math.min(10, Math.max(0, herd - tech.collared));
  const collarCost = techCost('collar', collarBatch);
  const vaccineCost = techCost('vaccine', herd);
  const scanCost = techCost('scan', herd);

  const body = `
    <p>科技买的是<strong>信息</strong>，不是数值加成。提前看到风险，才能提前做决定。</p>
    <div class="tech-grid">
      <div class="tech-card ${tech.collared > 0 ? 'owned' : ''}">
        <h3>智慧项圈</h3>
        <p>活动量、反刍时长、位置。发情与疾病早期预警。</p>
        <p class="modal-note">已佩戴 ${tech.collared} / ${herd} 头 · 每头每周 ¥3 维护</p>
        <button class="pixel-btn" id="tech-collar" ${collarBatch === 0 ? 'disabled' : ''}>
          再戴 ${collarBatch} 头（${yuan(collarCost)}）
        </button>
      </div>
      <div class="tech-card ${tech.vaccinated ? 'owned' : ''}">
        <h3>全群免疫</h3>
        <p>降低疫情爆发概率，也降低传播速度。</p>
        <p class="modal-note">${tech.vaccinated ? '本季已免疫' : '本季未免疫'} · 每周维护 ¥40</p>
        <button class="pixel-btn" id="tech-vaccine" ${tech.vaccinated ? 'disabled' : ''}>
          ${tech.vaccinated ? '已完成' : `接种（${yuan(vaccineCost)}）`}
        </button>
      </div>
      <div class="tech-card ${tech.scanned ? 'owned' : ''}">
        <h3>草场监测</h3>
        <p>精确生物量与承载力，避免放牧过量。</p>
        <p class="modal-note">${tech.scanned ? '已开通' : '未开通'} · 每周维护 ¥30</p>
        <button class="pixel-btn" id="tech-scan" ${tech.scanned ? 'disabled' : ''}>
          ${tech.scanned ? '已开通' : `开通（${yuan(scanCost)}）`}
        </button>
      </div>
    </div>
    <p class="modal-note">当前草场平均退化 ${percent(gameState.run.pasture.reduce((s, c) => s + c.degradation, 0) / gameState.run.pasture.length)}。</p>`;

  const el = ui.openModal({
    title: '科技服务',
    subtitle: `第 ${gameState.week} 周 · 剩余 ${gameState.actionsLeft} 个行动点`,
    body,
  });

  el.querySelector('#tech-collar')?.addEventListener('click', () => {
    gameState.act({ kind: 'tech', tech: 'collar' });
    ui.closeModal(true);
    openTechPanel();
  });
  el.querySelector('#tech-vaccine')?.addEventListener('click', () => {
    gameState.act({ kind: 'tech', tech: 'vaccine' });
    ui.closeModal(true);
    openTechPanel();
  });
  el.querySelector('#tech-scan')?.addEventListener('click', () => {
    gameState.act({ kind: 'tech', tech: 'scan' });
    ui.closeModal(true);
    openTechPanel();
  });
}
