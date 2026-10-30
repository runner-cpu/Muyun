import { gameState } from '../../core/GameState';
import { bcsLabel } from '../../sim/animal';
import { isBreedingEligible } from '../../sim/reproduction';
import { collarInsights } from '../../sim/insights';
import { ui } from '../instance';
import { animalFilters, animalPage, animalPagination, bindAnimalList } from './animalList';
import type { AnimalFilter } from './animalList';
import { actFromPanel } from './panelActions';
import { actionControl, escapeHtml, panelStatus, statRow } from './shared';
import { openTechPanel } from './tech';
import { openAnimalDetail } from './animalDetail';
import { sampleSceneAnimals } from '../../world/sceneState';

export function openHerdPanel(): void {
  let filter: AnimalFilter = 'all';
  let page = 0;
  const root = ui.openModal({ title: '畜群', subtitle: '查看每一头牲畜，安排治疗与繁育。', body: '' });

  const render = (): void => {
    const state = gameState.run;
    const herd = state.animals.filter((animal) => animal.alive);
    const sick = herd.filter((animal) => animal.health === 'sick').length;
    const pregnant = herd.filter((animal) => animal.pregnant).length;
    const eligible = herd.filter(isBreedingEligible).length;
    const averageBcs = herd.length ? herd.reduce((sum, animal) => sum + animal.bcs, 0) / herd.length : 0;
    const collars = collarInsights(state);
    const falling = collars.filter(collar => collar.delta !== null && collar.delta < 0);
    const thin = herd.filter(animal => animal.bcs < 2.5).length;
    const newborns = state.tracking ? Math.max(0, state.animals.length - state.tracking.baseline.population) : null;
    const list = animalPage(herd, filter, page);
    page = list.page;
    const rows = list.items.map((animal) => {
      const status = [animal.health === 'sick' ? '患病' : animal.health === 'subclinical' ? '亚临床' : '健康'];
      if (animal.pregnant) status.push('妊娠');
      if (animal.collar) status.push('已戴项圈');
      return `<tr>
        <td><button type="button" class="pixel-btn tiny" data-animal-detail="${escapeHtml(animal.id)}" aria-label="查看 ${escapeHtml(animal.tag)} 的个体档案">${escapeHtml(animal.tag)}</button></td><td>${animal.species === 'yak' ? '牦牛' : '藏羊'}</td>
        <td>${animal.sex === 'female' ? '母' : '公'}</td><td>${Math.round(animal.weightKg)} kg</td>
        <td>${animal.bcs.toFixed(1)} <em>${escapeHtml(bcsLabel(animal.bcs))}</em></td>
        <td class="${animal.health === 'sick' ? 'danger-text' : ''}">${status.join(' / ')}</td>
      </tr>`;
    }).join('');

    root.innerHTML = `
      ${statRow([[herd.length, '存栏'], [averageBcs.toFixed(1), '平均体况 BCS'], [pregnant, '妊娠'], [sick, '患病']])}
      ${panelStatus(state)}
      <p class="modal-note">场景抽样展示 ${sampleSceneAnimals(herd).length} / ${herd.length} 头真实个体，优先展示患病、偏瘦牲畜。红色菱形表示患病，黄色三角表示偏瘦或亚临床，青色颈带表示项圈。点击场景牲畜或下方耳标查看档案。</p>
      <p class="decision-herd-context">${sick > 0 ? `${sick} 头患病，优先核对治疗费用。` : '当前没有患病个体。'}${thin > 0 ? ` ${thin} 头 BCS 低于 2.5，留意本周饲草。` : ''} ${pregnant} 头在栏妊娠${newborns === null ? '' : `，记录起点后新增 ${newborns} 头`}。只有结局结算时仍在栏、存活的孕母参与产仔。</p>
      <div class="decision-context-action decision-context-compact"><p>${collars.length ? `已监测 ${collars.length} 头，${falling.length} 头在最近记录中体况下降；在科技面板查看个体差值与关注项。` : '佩戴项圈可查看个体的真实体况趋势；每头购置 ¥180，每周维护 ¥3。'}</p><button type="button" class="pixel-btn" id="herd-monitor">${collars.length ? '查看项圈记录' : '查看项圈费用'}</button></div>
      <div class="modal-actions panel-actions">
        ${actionControl(state, { kind: 'vet' }, '请兽医', 'id="panel-vet"', `1 行动点，治疗 ${sick} 头，费用 ¥${200 + 50 * sick}`)}
        ${actionControl(state, { kind: 'breed' }, '安排配种', 'id="panel-breed"', `1 行动点，${eligible} 头母畜符合条件，不花现金`)}
      </div>
      ${animalFilters(herd, filter, list)}
      ${list.items.length ? `<div class="table-wrap" role="region" aria-label="牲畜个体档案，可横向滚动" tabindex="0"><table class="data-table" aria-label="牲畜个体档案">
        <thead><tr><th scope="col">耳标 / 档案</th><th scope="col">种类</th><th scope="col">性别</th><th scope="col">体重</th><th scope="col">体况</th><th scope="col">状态</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : '<div class="empty-state"><h3>暂无牲畜</h3><p>可切换种类查看，已有牲畜的出售与死亡会同步到这里。</p></div>'}
      ${animalPagination(list)}
      <p class="modal-note">BCS 是 1-5 分的体况评分。配种需要适龄、未妊娠且 BCS 不低于 2.5 的母畜，成功后在本局结算时产仔。</p>`;

    bindAnimalList(root, filter, (nextFilter, nextPage) => { filter = nextFilter; page = nextPage; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-animal-detail]').forEach(button => {
      button.addEventListener('click', () => openAnimalDetail(button.dataset.animalDetail!));
    });
    root.querySelector('#panel-vet')?.addEventListener('click', () => actFromPanel({ kind: 'vet' }, ui, render));
    root.querySelector('#panel-breed')?.addEventListener('click', () => actFromPanel({ kind: 'breed' }, ui, render));
    root.querySelector('#herd-monitor')?.addEventListener('click', openTechPanel);
  };
  render();
}
