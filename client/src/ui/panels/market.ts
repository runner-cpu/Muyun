import { gameState } from '../../core/GameState';
import { animalPrice, hayPricePerKg } from '../../sim/economy';
import { ui } from '../instance';
import { yuan } from './shared';

const SELL_ROWS = 6;
const HIRE_COST = 3000;

export function openMarketPanel(): void {
  const season = gameState.season;
  const blizzard = gameState.weather === 'blizzard';
  const hayPrice = hayPricePerKg(season, blizzard);

  const sellable = gameState.animals
    .filter((animal) => animal.alive)
    .map((animal) => ({ animal, price: animalPrice(animal, season) }))
    .sort((a, b) => b.price - a.price)
    .slice(0, SELL_ROWS);

  const rows = sellable.map(({ animal, price }) => `
    <tr>
      <td>${animal.tag}</td>
      <td>${animal.species === 'yak' ? '牦牛' : '藏羊'}</td>
      <td>${Math.round(animal.weightKg)} kg</td>
      <td>${animal.bcs.toFixed(1)}</td>
      <td>${yuan(price)}</td>
      <td><button class="pixel-btn tiny" data-sell="${animal.id}">出售</button></td>
    </tr>`).join('');

  const body = `
    <p class="modal-note">当前草价 ${hayPrice.toFixed(2)} 元/kg ${blizzard ? '（暴雪翻倍）' : ''}</p>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>耳标</th><th>种类</th><th>体重</th><th>体况</th><th>估价</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="pixel-btn" id="buy-200">买 200 kg 草（${yuan(200 * hayPrice)}）</button>
      <button class="pixel-btn" id="buy-500">买 500 kg 草（${yuan(500 * hayPrice)}）</button>
      <button class="pixel-btn" id="hire">雇工（¥${HIRE_COST}，周成本 +¥260）</button>
    </div>`;

  const el = ui.openModal({
    title: '集市',
    subtitle: `第 ${gameState.week} 周 · 剩余 ${gameState.actionsLeft} 个行动点`,
    body,
  });

  for (const button of Array.from(el.querySelectorAll<HTMLButtonElement>('[data-sell]'))) {
    button.addEventListener('click', () => {
      gameState.act({ kind: 'sell', animalIds: [button.dataset.sell!] });
      ui.closeModal(true);
      openMarketPanel();
    });
  }
  el.querySelector('#buy-200')?.addEventListener('click', () => {
    gameState.act({ kind: 'buy-hay', kg: 200 });
    ui.closeModal(true);
    openMarketPanel();
  });
  el.querySelector('#buy-500')?.addEventListener('click', () => {
    gameState.act({ kind: 'buy-hay', kg: 500 });
    ui.closeModal(true);
    openMarketPanel();
  });
  el.querySelector('#hire')?.addEventListener('click', () => {
    gameState.act({ kind: 'hire' });
    ui.closeModal(true);
    openMarketPanel();
  });
}
