import { gameState } from '../../core/GameState';
import { carryingCapacitySheepUnits, sheepUnitEquivalent, totalBiomassKg } from '../../sim/pasture';
import { ui } from '../instance';
import { meter, percent, statRow } from './shared';

export function openPasturePanel(focusCellId?: string): void {
  const cells = gameState.pasture;
  const herd = gameState.animals.filter((animal) => animal.alive);
  const demand = herd.reduce((sum, animal) => sum + sheepUnitEquivalent(animal), 0);
  const biomass = totalBiomassKg(cells);

  const cards = cells.map((cell) => {
    const capacity = carryingCapacitySheepUnits(cell);
    const load = capacity > 0 ? Math.min(1.5, demand / capacity) : 0;
    const status = cell.grazing ? '放牧中' : cell.restedWeeks > 0 ? `休牧 ${cell.restedWeeks} 周` : '闲置';
    return `
      <div class="cell-card ${cell.id === focusCellId ? 'focus' : ''}">
        <h3>${cell.id} 区</h3>
        <p>现存量 <b>${Math.round(cell.biomassKgPerHa * cell.areaHa)}</b> kg</p>
        <p>可承载 <b>${Math.round(capacity)}</b> 羊单位 / 周</p>
        <p>退化 ${meter(cell.degradation, 1, cell.degradation > 0.5 ? 'warn' : '')} ${percent(cell.degradation)}</p>
        <p class="modal-note">${status}</p>
        <div class="cell-actions">
          <button class="pixel-btn tiny" data-graze="${cell.id}">放牧</button>
          <button class="pixel-btn tiny" data-cut="${cell.id}">割草</button>
        </div>
      </div>`;
  }).join('');

  const body = `
    ${statRow([[Math.round(biomass), '总生物量 kg'], [Math.round(demand), '当前载畜（羊单位）'], [`${gameState.pasture.filter(c => c.grazing).length}/4`, '在牧小区']])}
    <div class="cell-grid">${cards}</div>`;

  const el = ui.openModal({
    title: '草场',
    subtitle: `第 ${gameState.week} 周 · 剩余 ${gameState.actionsLeft} 个行动点`,
    body,
  });

  for (const button of Array.from(el.querySelectorAll<HTMLButtonElement>('[data-graze]'))) {
    button.addEventListener('click', () => {
      gameState.act({ kind: 'graze', cellId: button.dataset.graze! });
      ui.closeModal(true);
      openPasturePanel(button.dataset.graze);
    });
  }
  for (const button of Array.from(el.querySelectorAll<HTMLButtonElement>('[data-cut]'))) {
    button.addEventListener('click', () => {
      gameState.act({ kind: 'cut-hay', cellId: button.dataset.cut! });
      ui.closeModal(true);
      openPasturePanel(button.dataset.cut);
    });
  }
}
