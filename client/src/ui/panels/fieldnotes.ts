import { gameState } from '../../core/GameState';
import { buildFieldNotes } from '../../sim/fieldnotes';
import type { FieldNoteDestination } from '../../sim/fieldnotes';
import type { UIManager } from '../UIManager';
import { openHerdPanel } from './herd';
import { openMarketPanel } from './market';
import { openPasturePanel } from './pasture';
import { escapeHtml } from './shared';

/** Contextual field observations never spend actions or advance simulation time. */
export function openFieldNotes(ui: UIManager): void {
  const view = buildFieldNotes(gameState.run);
  const root = ui.openModal({
    title: '高原手记',
    subtitle: `${view.seasonLabel} · 第 ${view.week} 周 · 读懂这一局的经营关系`,
    body: `
      <div class="fieldnotes">
        <p class="fieldnotes-intro">从当前牧场出发，看看季节、草场与畜群如何相互影响。每则手记连接到可操作的经营面板。</p>
        ${view.notes.map((note, index) => `
          <section class="fieldnotes-entry${note.attention ? ' fieldnotes-attention' : ''}" aria-labelledby="fieldnote-${note.id}">
            <h3 id="fieldnote-${note.id}">${escapeHtml(note.title)}</h3>
            <p class="fieldnotes-observation">${escapeHtml(note.observation)}</p>
            <dl class="fieldnotes-evidence">
              ${note.evidence.map(item => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join('')}
            </dl>
            <details class="fieldnotes-mechanism"${index === 0 ? ' open' : ''}>
              <summary>这在本游戏中如何发生</summary>
              <p>${escapeHtml(note.mechanism)}</p>
            </details>
            <button type="button" class="pixel-btn" id="fieldnotes-open-${note.destination}">${escapeHtml(note.actionLabel)}</button>
          </section>`).join('')}
        <p class="fieldnotes-scope">以上为本游戏简化模型的当前数值与规则解释。干草等量周数仅以当前需草量折算，不包含未来放牧、体重变化或突发事件；冬夏增草对照使用同批本周未使用小区，保持当前草量与退化度一致。暴雪数值为游戏抽签参数，不能用于真实气象或生产决策。</p>
      </div>`,
  });
  const destinations: Record<FieldNoteDestination, () => void> = {
    pasture: () => openPasturePanel(), market: openMarketPanel, herd: openHerdPanel,
  };
  for (const [destination, open] of Object.entries(destinations)) {
    root.querySelector(`#fieldnotes-open-${destination}`)?.addEventListener('click', open);
  }
}
