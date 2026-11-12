import { gameState } from '../../core/GameState';
import { ui } from '../instance';
import { weekHistoryMarkup } from './reviewView';

/** Available during a run, without opening ending controls or starting a comparison job. */
export function openHistoryPanel(onBack: () => void): void {
  const root = ui.openModal({
    title: '逐周经营复盘',
    subtitle: '回看已经发生的行动、事件与结算',
    body: `${weekHistoryMarkup(gameState.run)}<div class="modal-actions"><button type="button" class="pixel-btn" id="history-back">返回本周概览</button></div>`,
  });
  root.querySelector('#history-back')?.addEventListener('click', onBack);
}
