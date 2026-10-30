import { gameState } from '../../core/GameState';
import { animalPrice, hayPricePerKg } from '../../sim/economy';
import type { RunState } from '../../sim/types';
import { actionLimit } from '../../sim/rules';
import { ui } from '../instance';
import { animalFilters, animalPage, animalPagination, bindAnimalList } from './animalList';
import type { AnimalFilter } from './animalList';
import { actFromPanel, actionStatus } from './panelActions';
import { actionControl, escapeHtml, panelStatus, yuan } from './shared';
import { openReservePanel } from './reserves';

export function customHayQuote(state: RunState, input: string): { kg: number | null; cost: number; reason: string | null } {
  const kg = input.trim() ? Number(input) : NaN;
  if (!Number.isSafeInteger(kg) || kg <= 0) return { kg: null, cost: 0, reason: '请输入大于零的整数公斤数。' };
  return { kg, ...actionStatus(state, { kind: 'buy-hay', kg }) };
}

export function openMarketPanel(): void {
  let filter: AnimalFilter = 'all';
  let page = 0;
  let hayInput = '100';
  const root = ui.openModal({ title: '集市', subtitle: '补充草料、安排人手，或出售牲畜回笼现金。', body: '' });

  const render = (): void => {
    const state = gameState.run;
    const blizzard = state.weather === 'blizzard';
    const hayPrice = hayPricePerKg(state.season, blizzard);
    const quote = customHayQuote(state, hayInput);
    const herd = state.animals.filter((animal) => animal.alive)
      .sort((a, b) => animalPrice(b, state.season) - animalPrice(a, state.season));
    const list = animalPage(herd, filter, page);
    page = list.page;
    const rows = list.items.map((animal) => {
      const price = animalPrice(animal, state.season);
      return `<tr>
        <td>${escapeHtml(animal.tag)}</td><td>${animal.species === 'yak' ? '牦牛' : '藏羊'}</td>
        <td>${Math.round(animal.weightKg)} kg</td><td>${animal.bcs.toFixed(1)}</td><td>${yuan(price)}</td>
        <td>${actionControl(state, { kind: 'sell', animalIds: [animal.id] }, '出售', `data-sell="${escapeHtml(animal.id)}" aria-label="出售 ${escapeHtml(animal.tag)}"`, `1 行动点，收入 ${yuan(price)}`)}</td>
      </tr>`;
    }).join('');
    root.innerHTML = `
      ${panelStatus(state)}
      <section class="panel-section"><h3>补给与人手</h3>
        <p class="modal-note">可用现金 ${yuan(state.money)}。当前草价 ${hayPrice.toFixed(2)} 元/kg${blizzard ? '，暴雪期间价格翻倍' : ''}。</p>
        <div class="modal-actions panel-actions">
          ${actionControl(state, { kind: 'buy-hay', kg: 200 }, '买草 200 kg', 'id="buy-200"')}
          ${actionControl(state, { kind: 'buy-hay', kg: 500 }, '买草 500 kg', 'id="buy-500"')}
          ${actionControl(state, { kind: 'hire' }, '雇一名帮工', 'id="hire"', `1 行动点，费用 ¥3,000；下周行动上限 ${actionLimit({ labor: state.labor + 1 })} 点，此后每周增加 ¥260 人工成本`)}
        </div>
        <form class="market-custom-hay" id="market-custom-hay" novalidate>
          <div class="market-hay-field">
            <label for="custom-hay-kg">自定义购草（整公斤）</label>
            <input id="custom-hay-kg" name="hay-kg" type="number" min="1" step="1" inputmode="numeric" required value="${escapeHtml(hayInput)}" aria-describedby="custom-hay-cost custom-hay-reason" aria-invalid="${quote.kg === null}">
          </div>
          <button type="submit" class="pixel-btn" id="buy-custom-hay" ${quote.reason ? 'disabled' : ''}>按数量买草</button>
          <div class="market-hay-feedback">
            <output id="custom-hay-cost" for="custom-hay-kg">${quote.kg === null ? '每次购买消耗 1 行动点。' : `1 行动点，费用 ${yuan(quote.cost)}`}</output>
            <p id="custom-hay-reason" class="market-hay-reason" role="status" aria-live="polite">${escapeHtml(quote.reason ?? '')}</p>
          </div>
        </form>
        <div class="reserve-market-link"><p class="modal-note">雇工与设备会持续扣费；出售会降低需草，也会减少距保留存栏下限的余量。</p><button type="button" class="pixel-btn tiny" id="market-reserves">先看三周储备账</button></div>
      </section>
      <section class="panel-section"><h3>出售牲畜</h3>
        <p class="modal-note">按估价从高到低排列。可切换种类、翻页选择每一头牲畜，出售后会立即离栏。</p>
        ${animalFilters(herd, filter, list)}
        ${list.items.length ? `<div class="table-wrap"><table class="data-table" aria-label="可出售的牲畜">
          <thead><tr><th scope="col">耳标</th><th scope="col">种类</th><th scope="col">体重</th><th scope="col">体况</th><th scope="col">估价</th><th scope="col">操作</th></tr></thead>
          <tbody>${rows}</tbody></table></div>` : '<div class="empty-state"><h3>没有可出售的牲畜</h3><p>切换种类查看其他牲畜；所有出售和死亡记录都会同步到存栏。</p></div>'}
        ${animalPagination(list)}
      </section>`;

    bindAnimalList(root, filter, (nextFilter, nextPage) => { filter = nextFilter; page = nextPage; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((button) => {
      button.addEventListener('click', () => actFromPanel({ kind: 'sell', animalIds: [button.dataset.sell!] }, ui, render));
    });
    root.querySelector('#buy-200')?.addEventListener('click', () => actFromPanel({ kind: 'buy-hay', kg: 200 }, ui, render));
    root.querySelector('#buy-500')?.addEventListener('click', () => actFromPanel({ kind: 'buy-hay', kg: 500 }, ui, render));
    root.querySelector('#hire')?.addEventListener('click', () => actFromPanel({ kind: 'hire' }, ui, render));
    root.querySelector('#market-reserves')?.addEventListener('click', () => openReservePanel(openMarketPanel));
    const customInput = root.querySelector<HTMLInputElement>('#custom-hay-kg')!;
    const customButton = root.querySelector<HTMLButtonElement>('#buy-custom-hay')!;
    const updateQuote = () => {
      hayInput = customInput.value;
      const current = customHayQuote(gameState.run, hayInput);
      root.querySelector<HTMLOutputElement>('#custom-hay-cost')!.textContent = current.kg === null
        ? '每次购买消耗 1 行动点。' : `1 行动点，费用 ${yuan(current.cost)}`;
      root.querySelector<HTMLElement>('#custom-hay-reason')!.textContent = current.reason ?? '';
      customInput.setAttribute('aria-invalid', String(current.kg === null));
      customButton.disabled = current.reason !== null;
      return current;
    };
    customInput.addEventListener('input', updateQuote);
    root.querySelector<HTMLFormElement>('#market-custom-hay')!.addEventListener('submit', event => {
      event.preventDefault();
      const current = updateQuote();
      if (current.kg === null || current.reason) return;
      const restoreInputFocus = document.activeElement === customInput;
      const completed = actFromPanel({ kind: 'buy-hay', kg: current.kg }, ui, render);
      if (completed && restoreInputFocus) root.querySelector<HTMLInputElement>('#custom-hay-kg')?.focus({ preventScroll: true });
    });
  };
  render();
}
