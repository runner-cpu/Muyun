import { gameState } from '../../core/GameState';
import type { EventCard } from '../../sim/types';
import { ui } from '../instance';

export function openEventPanel(card: EventCard): void {
  const choices = card.choices.map((choice) => `
    <button class="choice-card" data-choice="${choice.id}">
      <b>${choice.label}</b>
      <span>${choice.hint}</span>
    </button>`).join('');

  const el = ui.openModal({
    title: card.title,
    subtitle: `第 ${gameState.week} 周 · ${gameState.season === 'winter' ? '冬季' : ''}`,
    body: `<p>${card.body}</p><div class="choice-grid">${choices}</div>`,
    closable: false,
  });

  for (const button of Array.from(el.querySelectorAll<HTMLButtonElement>('[data-choice]'))) {
    button.addEventListener('click', () => {
      gameState.resolveEvent(card.id, button.dataset.choice!);
      ui.closeModal(true);
    });
  }
}
