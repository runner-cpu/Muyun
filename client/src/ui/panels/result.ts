import { gameState } from '../../core/GameState';
import { saveSystem } from '../../systems/SaveSystem';
import { ui } from '../instance';
import { percent, statRow, yuan } from './shared';

const ENDINGS: Record<string, [string, string]> = {
  bankrupt: ['破产', '账上没钱了，草料和药都买不起，只能把牲畜处理掉。'],
  collapse: ['生态崩溃', '草场退化到无法恢复，草畜平衡彻底失衡，只能迁走。'],
  subsistence: ['温饱', '撑过了这个冬天，但没攒下什么。明年还得从头再来。'],
  'well-off': ['小康', '收入不错，草场也还撑得住，日子有奔头。'],
  cooperative: ['合作社理事长', '规模和口碑都起来了，乡亲们愿意跟着你一起干。'],
};

export function openResultPanel(): void {
  const summary = gameState.summary();
  const ending = summary.ending ?? 'subsistence';
  const [title, text] = ENDINGS[ending] ?? ['结算', ''];

  const body = `
    <p>${text}</p>
    ${statRow([
      [yuan(summary.money), '现金'],
      [summary.herdSize, '存栏'],
      [summary.averageBcs.toFixed(2), '平均 BCS'],
      [percent(summary.averageDegradation), '草场退化'],
    ])}
    <p class="modal-note">口碑 ${summary.reputation} · 第 ${summary.week} 周结算</p>
    <div class="timeline">
      ${gameState.log.slice(-8).map((entry) => `<p class="log-${entry.tone}">第 ${entry.week} 周 · ${entry.text}</p>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="pixel-btn primary" id="result-again">再来一局</button>
    </div>`;

  const el = ui.openModal({ title: `结局 · ${title}`, body, closable: false });
  el.querySelector('#result-again')?.addEventListener('click', () => {
    saveSystem.clear();
    gameState.newGame();
    window.location.reload();
  });
}
