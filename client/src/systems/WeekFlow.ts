import { gameState } from '../core/GameState';
import { saveSystem } from './SaveSystem';
import { ui } from '../ui/instance';
import { openEventPanel } from '../ui/panels/event';
import { openResultPanel } from '../ui/panels/result';

/**
 * One click of "结束本周": settle the week, autosave, then either show the
 * settlement screen or deal the next week's event card.
 */
export function endWeekFlow(): void {
  if (gameState.ended) {
    openResultPanel();
    return;
  }

  gameState.endWeek();
  saveSystem.save(gameState.toData());

  if (gameState.ended) {
    openResultPanel();
    return;
  }

  const card = gameState.weekEvent();
  if (card) {
    ui.toast(`第 ${gameState.week} 周：${card.title}`, 'gold');
    openEventPanel(card);
  } else {
    ui.toast(`第 ${gameState.week} 周开始`, '', 1200);
  }
}
