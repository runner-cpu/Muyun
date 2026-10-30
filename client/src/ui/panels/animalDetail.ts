import { gameState } from '../../core/GameState';
import { bcsLabel } from '../../sim/animal';
import { collarInsights } from '../../sim/insights';
import { ui } from '../instance';
import { openHerdPanel } from './herd';
import { actFromPanel } from './panelActions';
import { actionControl, escapeHtml, panelStatus, statRow } from './shared';

/** Scene and table open the same living animal record by its persistent ID. */
export function openAnimalDetail(id: string): void {
  const animal = gameState.animals.find(item => item.id === id && item.alive);
  if (!animal) { ui.toast('这头牲畜已不在存栏中，请查看最新畜群。', 'bad'); return; }
  const root = ui.openModal({ title: `个体档案 · ${escapeHtml(animal.tag)}`, subtitle: `${animal.species === 'yak' ? '牦牛' : '藏羊'} · 真实耳标记录`, body: '' });
  const render = (): void => {
    const state = gameState.run;
    const current = state.animals.find(item => item.id === id && item.alive);
    if (!current) { openHerdPanel(); return; }
    const health = { healthy: '健康', subclinical: '亚临床，需观察', sick: '患病，需治疗' }[current.health];
    const sick = state.animals.filter(item => item.alive && item.health === 'sick').length;
    const collar = collarInsights(state).find(item => item.animalId === current.id);
    const trend = !current.collar ? '未佩戴项圈，暂无连续记录。'
      : collar?.delta === null || collar?.delta === undefined ? '已佩戴项圈，尚无完整测量区间。'
        : `最近记录区间 BCS ${collar.delta > 0 ? '+' : ''}${collar.delta.toFixed(2)}。`;
    const attention = current.health === 'sick' ? '这头牲畜已患病。请兽医会治疗当前全群患病个体。'
      : current.bcs < 2.5 ? '体况低于 2.5，先检查本周饲草安排；兽医只治疗患病个体。'
        : current.health === 'subclinical' ? '存在健康关注项，继续观察后续体况与健康变化。'
          : '当前体况与健康没有需优先处理的关注项。';
    root.innerHTML = `
      ${statRow([[`${Math.round(current.weightKg)} kg`, '当前体重'], [current.bcs.toFixed(1), '体况 BCS'], [health, '健康状态']])}
      <p class="modal-note">${escapeHtml(attention)}</p>
      <dl class="overview-ledger">
        <div><dt>耳标</dt><dd>${escapeHtml(current.tag)}</dd></div>
        <div><dt>性别</dt><dd>${current.sex === 'female' ? '母' : '公'}</dd></div>
        <div><dt>年龄</dt><dd>${current.ageWeeks} 周</dd></div>
        <div><dt>体况解释</dt><dd>${escapeHtml(bcsLabel(current.bcs))}</dd></div>
        <div><dt>繁育状态</dt><dd>${current.pregnant ? '妊娠' : current.lactating ? '泌乳' : '未妊娠'}</dd></div>
        <div><dt>项圈监测</dt><dd>${current.collar ? '已佩戴' : '未佩戴'}</dd></div>
      </dl>
      <p class="modal-note">${escapeHtml(trend)}</p>
      ${panelStatus(state)}
      <div class="modal-actions panel-actions">
        ${current.health === 'sick' ? actionControl(state, { kind: 'vet' }, '请兽医治疗全群', 'id="animal-vet"', `1 行动点，治疗全群 ${sick} 头患病牲畜，费用 ¥${200 + sick * 50}`) : ''}
        <button type="button" class="pixel-btn" id="animal-herd">查看全部畜群</button>
      </div>
      <p class="modal-note">场景抽样展示真实在栏个体；点击牲畜或畜群表中的耳标，均可查看此档案。</p>`;
    root.querySelector('#animal-vet')?.addEventListener('click', () => actFromPanel({ kind: 'vet' }, ui, render));
    root.querySelector('#animal-herd')?.addEventListener('click', openHerdPanel);
  };
  render();
}
