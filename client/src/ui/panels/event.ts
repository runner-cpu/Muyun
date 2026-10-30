import { gameState } from '../../core/GameState';
import type { EventCard } from '../../sim/types';
import { saveSystem } from '../../systems/SaveSystem';
import { seasonLabel } from '../../systems/Calendar';
import { ui } from '../instance';
import { pendingEventFlag } from '../ranchView';
import { eventChoiceStatus, visibleEventChoices } from '../../sim/rules';
import { escapeHtml } from './shared';
import { eventEffectSummary } from './eventView';

export function openEventPanel(card: EventCard): void {
  if (gameState.ended || gameState.run.usedEvents.includes(card.id)) return;
  const choices = visibleEventChoices(gameState.run, card).map((choice) => {
    const status = eventChoiceStatus(gameState.run, card.id, choice.id);
    return `<button class="choice-card" data-choice="${choice.id}" ${status.reason ? 'disabled' : ''}>
      <b>${escapeHtml(choice.label)}</b>
      <span>${escapeHtml(choice.hint)}</span>
      <span class="choice-effect">${escapeHtml(eventEffectSummary(gameState.run, choice.effect))}</span>
      ${status.reason ? `<span class="danger-text">${escapeHtml(status.reason)}</span>` : ''}
    </button>`;
  }).join('');

  const el = ui.openModal({
    title: card.title,
    subtitle: `第 ${gameState.week} 周 · ${seasonLabel(gameState.season)} · 请选择一个应对方式`,
    body: `<p>${escapeHtml(card.body)}</p><div class="choice-grid">${choices}</div>`,
    closable: false,
  });

  for (const button of Array.from(el.querySelectorAll<HTMLButtonElement>('[data-choice]'))) {
    button.addEventListener('click', () => {
      if (gameState.run.usedEvents.includes(card.id)) return;
      const before = gameState.run;
      gameState.resolveEvent(card.id, button.dataset.choice!);
      if (gameState.run === before) {
        ui.toast(eventChoiceStatus(before, card.id, button.dataset.choice!).reason ?? '无法执行该选择，请换一个方案。', 'bad');
        return;
      }
      gameState.setFlag(pendingEventFlag(gameState.week, card.id), false);
      const saved = saveSystem.save(gameState.toData());
      ui.closeModal(true);
      if (saved) ui.toast(gameState.log.at(-1)?.text ?? '已记录本次选择', 'good');
      else ui.toast('选择已生效，但浏览器未能保存。请勿关闭页面。', 'bad', 4500);
    });
  }
}
