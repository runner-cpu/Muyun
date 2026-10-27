import { audio } from '../systems/AudioManager';
import type { BattleResult } from '../types';
import type { UIManager } from '../ui/UIManager';
import { createBattle, hpRatio, resolveTurn, type BattleEvent, type BattleState } from './battle';

const SKILL_LABELS: Record<string, string> = {
  paw_smash: '喵喵拳', orange_charge: '橘猫冲撞', shadow_claw: '暗影爪',
  night_dash: '夜袭', snow_puff: '雪球弹', ice_tail: '冰霜尾',
};

export class PetBattleUI {
  constructor(private ui: UIManager) {}

  start(playerPetId: string): Promise<BattleResult> {
    const state = createBattle(playerPetId);
    const body = this.ui.openModal({
      title: '宠物对战',
      subtitle: '三系克制：橘 → 黑 → 白 → 橘 · 速度决定先手',
      closable: false,
      body: this.template(state),
    });
    audio.playSfx('confirm');

    return new Promise((resolve) => {
      const log = body.querySelector('#battle-log') as HTMLElement;
      const skillsEl = body.querySelector('#battle-skills') as HTMLElement;
      const playerHp = body.querySelector('#player-hp') as HTMLElement;
      const enemyHp = body.querySelector('#enemy-hp') as HTMLElement;
      const playerHpText = body.querySelector('#player-hp-text') as HTMLElement;
      const enemyHpText = body.querySelector('#enemy-hp-text') as HTMLElement;

      const render = (): void => {
        const pRatio = hpRatio(state.player);
        const eRatio = hpRatio(state.enemy);
        playerHp.style.width = `${pRatio * 100}%`;
        enemyHp.style.width = `${eRatio * 100}%`;
        playerHp.classList.toggle('low', pRatio < 0.3);
        enemyHp.classList.toggle('low', eRatio < 0.3);
        playerHpText.textContent = `${state.player.currentHp}/${state.player.maxHp}`;
        enemyHpText.textContent = `${state.enemy.currentHp}/${state.enemy.maxHp}`;
        if (state.over) {
          skillsEl.innerHTML = '';
          this.showResult(body, state, resolve);
          return;
        }
        skillsEl.innerHTML = '';
        for (const skillId of state.player.skills) {
          const btn = document.createElement('button');
          btn.className = 'skill-btn';
          btn.innerHTML = `<b>${SKILL_LABELS[skillId] ?? skillId}</b><span>${skillId === state.player.skills[0] ? '稳定输出' : '强力一击'}</span>`;
          btn.addEventListener('click', () => {
            const events = resolveTurn(state, skillId);
            for (const event of events) this.appendEvent(log, event);
            audio.playSfx('hit');
            const panel = body.querySelector(eventPanelSelector(events, body));
            panel?.classList.add('flash');
            window.setTimeout(() => panel?.classList.remove('flash'), 280);
            render();
          });
          skillsEl.appendChild(btn);
        }
      };

      render();
    });
  }

  private template(state: BattleState): string {
    return `
      <div class="battle-arena">
        <div class="pet-panel" id="player-panel">
          <div class="pet-name">${state.player.name}<span>你</span></div>
          <div class="hp-track"><div class="hp-fill" id="player-hp" style="width:100%"></div></div>
          <div class="battle-hint"><span id="player-hp-text">${state.player.maxHp}/${state.player.maxHp}</span> · ${state.player.description}</div>
        </div>
        <div class="battle-vs">VS</div>
        <div class="pet-panel enemy" id="enemy-panel">
          <div class="pet-name">${state.enemy.name}<span>训练师</span></div>
          <div class="hp-track"><div class="hp-fill" id="enemy-hp" style="width:100%"></div></div>
          <div class="battle-hint"><span id="enemy-hp-text">${state.enemy.maxHp}/${state.enemy.maxHp}</span> · ${state.enemy.description}</div>
        </div>
      </div>
      <div class="battle-log" id="battle-log"><p>战斗开始！${state.player.name} vs ${state.enemy.name}</p></div>
      <div class="skills" id="battle-skills"></div>
      <p class="battle-hint">选择技能后，双方按速度依次行动。</p>`;
  }

  private appendEvent(log: HTMLElement, event: BattleEvent): void {
    const who = event.actor === 'player' ? '你的猫' : '对手';
    const effect = event.multiplier > 1 ? '效果拔群！' : event.multiplier < 1 ? '效果不太好……' : '';
    const line = document.createElement('p');
    line.textContent = `${who} 使用了 ${event.skill.name}，造成 ${event.damage} 点伤害。${effect}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  private showResult(body: HTMLElement, state: BattleState, resolve: (result: BattleResult) => void): void {
    const win = Boolean(state.win);
    const rewards = win ? { credit: 6, mood: 8 } : { credit: 0, mood: 2 };
    const result = document.createElement('div');
    result.innerHTML = `
      <div class="stat-row">
        <div><b>${win ? '胜利' : '惜败'}</b><span>${win ? '训练师点了点头' : '再找一只猫练练'}</span></div>
        <div><b>+${rewards.credit}</b><span>学分</span></div>
        <div><b>+${rewards.mood}</b><span>心情</span></div>
      </div>
      <div class="modal-actions">
        <button class="pixel-btn primary" id="battle-return">返回校园</button>
      </div>`;
    body.appendChild(result);
    audio.playSfx(win ? 'win' : 'lose');
    result.querySelector('#battle-return')?.addEventListener('click', () => {
      this.ui.closeModal(true);
      resolve({ win, rewards });
    });
  }
}

function eventPanelSelector(events: BattleEvent[], body: HTMLElement): string {
  const last = events[events.length - 1];
  if (!last) return '#player-panel';
  return last.actor === 'player' ? '#enemy-panel' : '#player-panel';
}
