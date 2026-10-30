import { gameState } from '../../core/GameState';
import type { Action } from '../../sim/types';
import { saveSystem } from '../../systems/SaveSystem';

export { actionStatus } from '../../sim/rules';
import { actionStatus } from '../../sim/rules';

interface Feedback { toast(text: string, tone: '' | 'good' | 'bad' | 'gold', duration?: number): void }

/** Keep the panel mounted, report the actual simulation result, then persist it. */
export function actFromPanel(action: Action, feedback: Feedback, refresh: () => void): boolean {
  const before = gameState.run;
  const status = actionStatus(before, action);
  if (status.reason) { feedback.toast(status.reason, 'bad'); return false; }
  gameState.act(action);
  if (gameState.run === before) {
    feedback.toast('这次操作未能完成，请检查现金、行动点和牲畜状态。', 'bad');
    return false;
  }
  const result = gameState.log.at(-1);
  feedback.toast(result?.text ?? '经营操作已完成。', result?.tone === 'bad' ? 'bad' : 'good');
  if (!saveSystem.save(gameState.toData())) feedback.toast('操作已完成，但浏览器未能保存。请检查存储权限。', 'bad', 3600);
  const focused = typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null;
  const modal = focused?.closest<HTMLElement>('[role="dialog"]');
  const focusId = focused?.id;
  refresh();
  if (modal?.isConnected && focused && !focused.isConnected) {
    const next = focusId ? document.getElementById(focusId) : null;
    if (next instanceof HTMLButtonElement && !next.disabled) next.focus({ preventScroll: true });
    else modal.focus({ preventScroll: true });
  }
  return true;
}
