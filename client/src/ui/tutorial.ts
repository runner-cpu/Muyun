import { TutorialWeek } from '../core/TutorialWeek';
import { actionStatus } from '../sim/rules';
import { ui } from './instance';
import { completeTutorial } from './tutorialPreferences';
import { escapeHtml, yuan } from './panels/shared';

// Display whole kg without promoting binary tails such as 462.00000000000006.
const kg = (value: number): string => `${Math.ceil(Math.max(0, value - 1e-6)).toLocaleString('zh-CN')} kg`;

function figures(need: number, available: number, gap: number): string {
  return `<dl class="tutorial-figures"><div><dt>本周需草</dt><dd>${kg(need)}</dd></div><div><dt>实际可用草</dt><dd>${kg(available)}</dd></div><div class="${gap > 0 ? 'danger-text' : ''}"><dt>饲草缺口</dt><dd>${kg(gap)}</dd></div></dl>`;
}

/** An isolated feeding lesson; closing it simply discards this in-memory session. */
export function openTutorialWeek(): void {
  const session = new TutorialWeek();
  const root = ui.openModal({
    title: '教学周 · 先喂饱牦牛',
    subtitle: '8 头牦牛 · 先放牧，再看缺口',
    body: '<div id="tutorial-content"></div>',
    onClose: () => document.getElementById('modal-card')?.classList.remove('tutorial-modal'),
  });
  document.getElementById('modal-card')?.classList.add('tutorial-modal');
  const host = root.querySelector<HTMLElement>('#tutorial-content');
  if (!host) return;

  const render = (focusId?: string): void => {
    const view = session.snapshot;
    const graze = actionStatus(session.state, { kind: 'graze', cellId: 'P1' });
    const purchaseKg = view.topUpKg || view.fixedBuyKg;
    const purchase = actionStatus(session.state, { kind: 'buy-hay', kg: purchaseKg });
    const hint = view.gapKg === 0 ? '饲草已够。结束教学周，看看这一周的实际结果。'
      : view.grazedKg > 0 ? `放牧已提供 ${kg(view.grazedKg)}，还缺 ${kg(view.gapKg)}；按缺口补草，观察数字变化。`
        : '先试着放牧 P1：放牧提供本周可吃的草，剩下的缺口再用干草补足。';
    host.innerHTML = `<section aria-label="教学周练习">
      ${figures(view.needKg, view.availableKg, view.gapKg)}
      <p class="tutorial-hint" role="status">${hint}</p>
      <div class="tutorial-actions">
        <div><button type="button" class="pixel-btn" id="tutorial-graze" ${graze.reason ? 'disabled' : ''}>放牧 P1</button><span class="tutorial-action-note">${escapeHtml(graze.reason ?? '使用 1 个行动点，不花现金')}</span></div>
        <div><label for="tutorial-quantity" class="tutorial-buy-label">购草数量</label><select id="tutorial-quantity"><option value="${purchaseKg}">${view.topUpKg ? `按缺口补 ${kg(purchaseKg)}` : `固定 ${kg(view.fixedBuyKg)}`}</option>${purchaseKg !== view.fixedBuyKg ? `<option value="${view.fixedBuyKg}">固定 ${kg(view.fixedBuyKg)}</option>` : ''}</select><button type="button" class="pixel-btn" id="tutorial-buy" ${purchase.reason ? 'disabled' : ''}>购草 · ${yuan(purchase.cost)}</button><span class="tutorial-action-note" id="tutorial-buy-note">${escapeHtml(purchase.reason ?? `使用 1 个行动点；现有现金 ${yuan(view.cash)}`)}</span></div>
      </div>
      <p class="tutorial-scope">本周可用行动 ${view.actionsLeft} / 2。仅开放 P1；P2–P4 本周未开放。<br>本练习只运行原模型的确定性饲喂结算，无雇工、设备或随机事件；正式经营还有四季与健康风险。</p>
      <div class="modal-actions"><button type="button" class="pixel-btn primary" id="tutorial-settle">结束教学周</button></div>
    </section>`;
    const select = host.querySelector<HTMLSelectElement>('#tutorial-quantity')!;
    const buy = host.querySelector<HTMLButtonElement>('#tutorial-buy')!;
    select.addEventListener('change', () => {
      const status = actionStatus(session.state, { kind: 'buy-hay', kg: Number(select.value) });
      buy.disabled = Boolean(status.reason);
      buy.textContent = `购草 · ${yuan(status.cost)}`;
      host.querySelector('#tutorial-buy-note')!.textContent = status.reason ?? `使用 1 个行动点；现有现金 ${yuan(view.cash)}`;
    });
    host.querySelector('#tutorial-graze')?.addEventListener('click', () => {
      if (session.act({ kind: 'graze', cellId: 'P1' })) render('tutorial-quantity');
    });
    buy.addEventListener('click', () => {
      if (session.act({ kind: 'buy-hay', kg: Number(select.value) })) render('tutorial-settle');
    });
    host.querySelector('#tutorial-settle')?.addEventListener('click', () => {
      const result = session.settle();
      completeTutorial();
      host.innerHTML = `<section aria-label="教学复盘"><h3 class="tutorial-review-title">这一周，草够吃了吗？</h3>
        ${figures(result.needKg, result.availableKg, result.gapKg)}
        <p class="tutorial-hint" role="status">${escapeHtml(result.sentence)}</p>
        <p class="tutorial-scope">数字取自饲喂前的真实供需。正式经营中，也可以通过出售牲畜降低需草量；本练习只开放放牧和购草。</p>
        <div class="modal-actions"><button type="button" class="pixel-btn" id="tutorial-retry">再玩一次教学周</button><button type="button" class="pixel-btn primary" id="tutorial-enter-year">进入完整经营</button></div></section>`;
      document.getElementById('modal-title')!.textContent = '教学复盘';
      host.querySelector('#tutorial-retry')?.addEventListener('click', openTutorialWeek);
      host.querySelector('#tutorial-enter-year')?.addEventListener('click', () => { ui.closeModal(); ui.onNewGame?.(); });
      host.querySelector<HTMLElement>('#tutorial-enter-year')?.focus({ preventScroll: true });
    }, { once: true });
    if (focusId) host.querySelector<HTMLElement>(`#${focusId}`)?.focus({ preventScroll: true });
  };
  render();
}
