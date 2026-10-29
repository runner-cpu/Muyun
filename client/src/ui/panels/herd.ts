import { gameState } from '../../core/GameState';
import { bcsLabel } from '../../sim/animal';
import { ui } from '../instance';
import { statRow } from './shared';

const MAX_ROWS = 40;

export function openHerdPanel(): void {
  const herd = gameState.animals.filter((animal) => animal.alive);
  const sick = herd.filter((animal) => animal.health === 'sick').length;
  const pregnant = herd.filter((animal) => animal.pregnant).length;
  const averageBcs = herd.length
    ? herd.reduce((sum, animal) => sum + animal.bcs, 0) / herd.length
    : 0;

  const rows = herd.slice(0, MAX_ROWS).map((animal) => `
    <tr>
      <td>${animal.tag}</td>
      <td>${animal.species === 'yak' ? '牦牛' : '藏羊'}</td>
      <td>${animal.sex === 'female' ? '母' : '公'}</td>
      <td>${Math.round(animal.weightKg)}</td>
      <td>${animal.bcs.toFixed(1)} <em>${bcsLabel(animal.bcs)}</em></td>
      <td>${animal.health === 'sick' ? '<b class="danger-text">患病</b>' : animal.pregnant ? '妊娠' : '—'}</td>
    </tr>`).join('');

  const vetCost = 200 + 50 * sick;
  const body = `
    ${statRow([[herd.length, '存栏'], [averageBcs.toFixed(2), '平均 BCS'], [pregnant, '妊娠'], [sick, '患病']])}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>耳标</th><th>种类</th><th>性别</th><th>体重 kg</th><th>体况</th><th>状态</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${herd.length > MAX_ROWS ? `<p class="modal-note">只显示前 ${MAX_ROWS} 头，共 ${herd.length} 头。</p>` : ''}
    <div class="modal-actions">
      <button class="pixel-btn" id="panel-vet" ${sick === 0 ? 'disabled' : ''}>请兽医（${sick} 头 / ¥${vetCost}）</button>
      <button class="pixel-btn" id="panel-breed">配种</button>
    </div>`;

  const el = ui.openModal({
    title: '畜群',
    subtitle: `第 ${gameState.week} 周 · 剩余 ${gameState.actionsLeft} 个行动点`,
    body,
  });

  el.querySelector('#panel-vet')?.addEventListener('click', () => {
    gameState.act({ kind: 'vet' });
    ui.closeModal(true);
    openHerdPanel();
  });
  el.querySelector('#panel-breed')?.addEventListener('click', () => {
    gameState.act({ kind: 'breed' });
    ui.closeModal(true);
    openHerdPanel();
  });
}
