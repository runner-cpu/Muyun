import { gameState } from '../core/GameState';
import { saveSystem } from './SaveSystem';
import { ui } from '../ui/instance';
import { openEventPanel } from '../ui/panels/event';
import { openResultPanel } from '../ui/panels/result';
import { escapeHtml, pendingEventFlag, pendingEventForRun, ranchSnapshot } from '../ui/ranchView';
import { statRow, yuan } from '../ui/panels/shared';
import { actionLimit } from '../sim/rules';

/** Confirm the forecast first; a second deliberate click performs the week step. */
export function endWeekFlow(): void {
  if (gameState.ended) {
    openResultPanel();
    return;
  }

  const pending = pendingEventForRun(gameState.run);
  if (pending) {
    openEventPanel(pending);
    return;
  }

  const view = ranchSnapshot(gameState.run);
  const body = ui.openModal({
    title: `结束第 ${gameState.week} 周？`,
    subtitle: '本周将统一喂养畜群，并结算生长、疫病、天气与费用。',
    body: `
      <div class="overview-feed ${view.feedTone}"><h3>${view.headline}</h3><p>${view.hint}</p></div>
      <dl class="overview-ledger">
        <div><dt>需消耗干草</dt><dd>${Math.ceil(view.feedRequiredHayKg).toLocaleString('zh-CN')} kg</dd></div>
        <div><dt>现有干草</dt><dd>${gameState.hayKg.toLocaleString('zh-CN')} kg</dd></div>
        <div><dt>人工与维护费</dt><dd>${yuan(view.weeklyCost)}</dd></div>
        <div><dt>扣除固定费用后现金</dt><dd class="${view.cashAtRisk ? 'danger-text' : ''}">${yuan(view.cashAfterCosts)}${view.cashAtRisk ? ' · 将耗尽' : ''}</dd></div>
        <div><dt>尚未使用的行动点</dt><dd>${gameState.actionsLeft}</dd></div>
      </dl>
      <p class="modal-note">${gameState.actionsLeft > 0 ? '剩余行动点不会保留，可以返回继续安排。' : `行动点已用完，下一周将恢复为 ${actionLimit(gameState.run)} 点。`} 预估未计入随机天气与事件。</p>
      <div class="modal-actions"><button class="pixel-btn" id="week-cancel">继续安排</button><button class="pixel-btn primary" id="week-confirm">确认结算</button></div>`,
  });
  body.querySelector('#week-cancel')?.addEventListener('click', () => ui.closeModal());
  let confirmed = false;
  body.querySelector('#week-confirm')?.addEventListener('click', () => {
    if (confirmed) return;
    confirmed = true;
    settleWeek();
  });
}

function settleWeek(): void {
  const before = gameState.toData().run;
  const previousView = ranchSnapshot(before);
  gameState.endWeek();
  const after = gameState.run;
  const view = ranchSnapshot(after);
  const card = gameState.ended ? null : gameState.weekEvent();
  if (card) gameState.setFlag(pendingEventFlag(after.week, card.id));
  const saved = saveSystem.save(gameState.toData());
  if (!saved) ui.toast('本周已结算，但浏览器未能保存。请勿关闭页面。', 'bad', 4500);
  const logs = after.log.slice(before.log.length);
  const delta = (value: number): string => `${value > 0 ? '+' : ''}${value.toLocaleString('zh-CN')}`;
  const bcsDelta = view.averageBcs - previousView.averageBcs;

  const body = ui.openModal({
    title: `第 ${before.week} 周经营回顾`,
    subtitle: after.ended ? '冬季结束，这一局即将结算。' : `第 ${after.week} 周已开始，行动点恢复为 ${actionLimit(after)} 点。`,
    closable: false,
    body: `
      <p class="panel-intro">本次周结算带来的实际变化</p>
      <div class="settlement-delta">${statRow([
        [`${delta(after.money - before.money)} 元`, '现金变化'],
        [`${delta(after.hayKg - before.hayKg)} kg`, '干草变化'],
        [`${delta(view.aliveCount - previousView.aliveCount)} 头`, '存栏变化'],
        [`${bcsDelta > 0 ? '+' : ''}${bcsDelta.toFixed(2)}`, '平均体况变化'],
      ])}</div>
      <div class="overview-log">${logs.length
        ? logs.map((entry) => `<p class="log-${entry.tone}">${escapeHtml(entry.text)}</p>`).join('')
        : '<p>本周没有额外的疫病、灾损或事件记录。</p>'}</div>
      <p class="modal-note">当前现金 ${yuan(after.money)}，干草 ${after.hayKg.toLocaleString('zh-CN')} kg，存栏 ${view.aliveCount} 头。</p>
      <div class="modal-actions"><button class="pixel-btn primary" id="week-next">${after.ended ? '查看结局' : card ? '处理本周事件' : '返回牧场'}</button></div>`,
  });
  body.querySelector('#week-next')?.addEventListener('click', () => {
    ui.closeModal(true);
    if (gameState.ended) openResultPanel();
    else if (card) openEventPanel(card);
  });
}

/** Called once after RanchScene has mounted its HUD, including when continuing a save. */
export function resumePendingWeek(): void {
  if (gameState.ended) {
    openResultPanel();
    return;
  }
  const pending = pendingEventForRun(gameState.run);
  if (pending) openEventPanel(pending);
}
