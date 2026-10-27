import { gameState } from '../core/GameState';
import { audio } from './AudioManager';
import { isCanteenOpen, isLibraryOpen, type TimeSystem } from './TimeSystem';
import type { DialogueSystem } from './DialogueSystem';
import type { TriggerDef } from '../types';
import type { UIManager } from '../ui/UIManager';
import type { PetBattleUI } from '../minigames/PetBattleUI';
import type { HideSeekGame } from '../minigames/HideSeekGame';
import catsData from '../data/cats.json';
import type { CatDef } from '../types';
import { MEALS, QUIZZES, grandstandBody, noticeBody, seatBody, timetableBody } from '../data/content';

const cats = catsData as CatDef[];

export interface InteractionHost {
  time: TimeSystem;
  dialogue: DialogueSystem;
  battle: PetBattleUI;
  hideSeek: HideSeekGame;
  persist: () => void;
  refreshLights: () => void;
  sleep: () => void;
}

export class InteractionController {
  constructor(private ui: UIManager, private host: InteractionHost) {}

  handle(trigger: TriggerDef): void {
    audio.playSfx('blip');
    switch (trigger.kind) {
      case 'dialogue': void this.host.dialogue.start(trigger.payload); break;
      case 'signin': this.signIn(); break;
      case 'notice': this.notice(); break;
      case 'class': this.attendClass(); break;
      case 'timetable': this.timetable(); break;
      case 'library_quiz': this.libraryQuiz(); break;
      case 'seat_hint': this.seatHint(); break;
      case 'meal': this.meal(); break;
      case 'sleep': this.sleep(); break;
      case 'door': this.ui.toast('室内空间会在 v2 开放，先在校园里逛逛吧', 'gold'); break;
      case 'cat': this.cat(trigger.payload); break;
      case 'battle': this.startBattle(); break;
      case 'hideseek': this.startHideSeek(); break;
      case 'hidespot': this.host.hideSeek.inspect(trigger.payload); break;
      case 'grandstand': this.grandstand(); break;
      case 'vending': this.vending(); break;
      case 'streetlight': this.streetlight(); break;
      default: this.ui.toast('这里暂时还没有内容', 'bad');
    }
  }

  private signIn(): void {
    const result = gameState.signIn();
    if (!result.ok) {
      this.ui.toast('今天已经签过到了，明天再来', 'bad');
      return;
    }
    this.ui.toast(`签到成功！连续 ${result.streak} 天 · 学分 +${result.reward} · 心情 +1`, 'gold', 2400);
    if (result.streak >= 7) gameState.unlockAchievement('signin_7');
    audio.playSfx('collect');
    this.host.persist();
  }

  private attendClass(): void {
    if (gameState.hasFlag(`class_${gameState.day}`)) {
      this.ui.toast('今天的课已经上完了，去学生食堂或西田径场看看吧', 'bad');
      return;
    }
    if (gameState.timeMinutes < 8 * 60 || gameState.timeMinutes >= 21 * 60) {
      this.ui.toast('教学楼已经关门了，明天 08:00 再来', 'bad');
      return;
    }
    const body = this.ui.openModal({
      title: '睿智楼 · 今日课程',
      subtitle: '《像素渲染与校园漫游》· 302 教室',
      body: `<p>老师正在讲“为什么 16×16 的瓦片能装下一整座校园”。</p>
        <p class="modal-note">认真听讲：学分 +5，心情 -2。也可以直接溜走。</p>
        <div class="modal-actions">
          <button class="pixel-btn" id="class-skip">溜了</button>
          <button class="pixel-btn primary" id="class-attend">认真听讲</button>
        </div>`,
    });
    body.querySelector('#class-skip')?.addEventListener('click', () => this.ui.closeModal());
    body.querySelector('#class-attend')?.addEventListener('click', () => {
      gameState.addCredits(5);
      gameState.addMood(-2);
      gameState.setFlag(`class_${gameState.day}`);
      gameState.unlockAchievement('first_class');
      this.ui.closeModal();
      this.ui.toast('上课完成：学分 +5 · 心情 -2', 'good', 2200);
      audio.playSfx('confirm');
      this.host.persist();
    });
  }

  private timetable(): void {
    this.ui.openModal({
      title: '课程表',
      subtitle: '周一 · 睿智楼 302',
      body: timetableBody(),
    }).querySelector('#timetable-close')?.addEventListener('click', () => this.ui.closeModal());
  }

  private libraryQuiz(): void {
    if (!isLibraryOpen(gameState.timeMinutes)) {
      this.ui.toast('图书馆 08:00—22:00 开放，现在闭馆了', 'bad');
      return;
    }
    if (gameState.hasFlag(`quiz_${gameState.day}`)) {
      this.ui.toast('今天已经答过题了，明天再来', 'bad');
      return;
    }
    const question = QUIZZES[(gameState.day - 1) % QUIZZES.length];
    const body = this.ui.openModal({
      title: '图书馆 · 知识问答',
      subtitle: '答对 +2 学分 · 每天一次',
      body: `<p>${question.q}</p><div class="choice-grid">${question.options.map((option, i) => `<button class="choice-card" data-answer="${i}"><b>${option}</b><span>选这个</span></button>`).join('')}</div>`,
    });
    body.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = Number(btn.dataset.answer);
        gameState.setFlag(`quiz_${gameState.day}`);
        if (chosen === question.answer) {
          gameState.addCredits(2);
          gameState.addMood(2);
          this.ui.toast(`答对了！${question.note} 学分 +2`, 'good', 2600);
          audio.playSfx('collect');
        } else {
          this.ui.toast(`差一点。${question.note}`, 'bad', 2600);
          audio.playSfx('cancel');
        }
        this.ui.closeModal();
        this.host.persist();
      });
    });
  }

  private seatHint(): void {
    if (!isLibraryOpen(gameState.timeMinutes)) {
      this.ui.toast('图书馆已经闭馆了', 'bad');
      return;
    }
    this.ui.openModal({
      title: '图书馆 · 座位提示',
      subtitle: '靠窗的位置最抢手',
      body: seatBody(),
    }).querySelector('#seat-close')?.addEventListener('click', () => this.ui.closeModal());
  }

  private meal(): void {
    if (!isCanteenOpen(gameState.timeMinutes)) {
      this.ui.toast('食堂开放时间：11:30—13:30 / 17:30—19:30', 'bad', 2600);
      return;
    }
    if (gameState.hasFlag(`meal_${gameState.day}`)) {
      this.ui.toast('今天已经吃过饭了，晚点再来看看夜宵', 'bad');
      return;
    }
    const body = this.ui.openModal({
      title: '学生食堂 · 打饭三选一',
      subtitle: '阿姨的手很稳，心情 +？',
      body: `<div class="choice-grid">${MEALS.map((meal, i) => `<button class="choice-card" data-meal="${i}"><b>${meal.name}</b><span>${meal.desc}</span></button>`).join('')}</div>`,
    });
    body.querySelectorAll<HTMLButtonElement>('[data-meal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const meal = MEALS[Number(btn.dataset.meal)];
        gameState.addMood(meal.mood);
        gameState.setFlag(`meal_${gameState.day}`);
        this.ui.closeModal();
        this.ui.toast(`${meal.name}下肚，心情 +${meal.mood}`, 'good', 2200);
        audio.playSfx('confirm');
        this.host.persist();
      });
    });
  }

  private sleep(): void {
    const body = this.ui.openModal({
      title: '回学生公寓睡觉',
      subtitle: `现在是 DAY ${gameState.day} ${String(Math.floor(gameState.timeMinutes / 60)).padStart(2, '0')}:${String(gameState.timeMinutes % 60).padStart(2, '0')}`,
      body: `<p>睡觉会推进到第二天 08:00，并自动存档。</p>
        <p class="modal-note">今天还可以在校园里再逛一会儿，猫不会跑。</p>
        <div class="modal-actions">
          <button class="pixel-btn" id="sleep-cancel">再逛逛</button>
          <button class="pixel-btn primary" id="sleep-confirm">睡觉</button>
        </div>`,
    });
    body.querySelector('#sleep-cancel')?.addEventListener('click', () => this.ui.closeModal());
    body.querySelector('#sleep-confirm')?.addEventListener('click', () => {
      this.ui.closeModal();
      this.host.sleep();
    });
  }

  private cat(id: string): void {
    const cat = cats.find((c) => c.id === id);
    if (!cat) return;
    if (!gameState.hasCat(id)) {
      gameState.collectCat(id);
      gameState.addMood(3);
      gameState.unlockAchievement('first_cat');
      if (gameState.cats.length === cats.length) gameState.unlockAchievement('all_cats');
      this.ui.toast(`${cat.name} 加入了猫图鉴！心情 +3`, 'good', 2400);
      audio.playSfx('collect');
      void this.host.dialogue.say(`校园猫 · ${cat.name}`, `${cat.description} 它蹭了蹭你的裤脚。`);
    } else {
      const flag = `petcat_${id}_${gameState.day}`;
      if (!gameState.hasFlag(flag)) {
        gameState.setFlag(flag);
        gameState.addMood(2);
        this.ui.toast(`又撸到了${cat.name}，心情 +2`, 'good');
        audio.playSfx('cat');
      } else {
        void this.host.dialogue.say(`校园猫 · ${cat.name}`, '喵——它今天已经被你摸得很满足了。');
      }
    }
    this.host.persist();
  }

  private startBattle(): void {
    if (gameState.hasFlag(`battle_${gameState.day}`)) {
      this.ui.toast('今天已经挑战过训练师了，明天再来', 'bad');
      return;
    }
    const battleCats = cats.filter((cat) => cat.petId && gameState.hasCat(cat.id));
    if (battleCats.length === 0) {
      this.ui.toast('先去校园里找一只可出战的猫（大橘 / 煤球 / 雪球）', 'bad', 2600);
      return;
    }
    const body = this.ui.openModal({
      title: '选择出战猫咪',
      subtitle: '橘 → 黑 → 白 → 橘 · 伤害 ×1.5',
      body: `<div class="choice-grid">${battleCats.map((cat) => `<button class="choice-card" data-pet="${cat.petId}"><b>${cat.name}</b><span>${cat.description}</span></button>`).join('')}</div>`,
    });
    body.querySelectorAll<HTMLButtonElement>('[data-pet]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const petId = btn.dataset.pet!;
        this.ui.closeModal();
        void this.host.battle.start(petId).then((result) => {
          gameState.setFlag(`battle_${gameState.day}`);
          gameState.addCredits(result.rewards.credit);
          gameState.addMood(result.rewards.mood);
          if (result.win) gameState.unlockAchievement('battle_first');
          this.host.persist();
          this.ui.toast(result.win ? '对战胜利！奖励已到账' : '对战结束，训练师让你明天再来', result.win ? 'good' : '', 2200);
        });
      });
    });
  }

  private startHideSeek(): void {
    const result = this.host.hideSeek.start();
    if (result === 'started') this.host.persist();
  }

  private grandstand(): void {
    const first = !gameState.hasFlag(`grandstand_${gameState.day}`);
    if (first) {
      gameState.setFlag(`grandstand_${gameState.day}`);
      gameState.addMood(1);
    }
    this.ui.openModal({
      title: '西田径场看台',
      subtitle: '傍晚的风和跑道的味道',
      body: grandstandBody(first),
    }).querySelector('#stand-close')?.addEventListener('click', () => this.ui.closeModal());
    if (first) this.host.persist();
  }

  private vending(): void {
    if (gameState.hasFlag(`vending_${gameState.day}`)) {
      this.ui.toast('今天已经买过一瓶了，喝多了晚上睡不着', 'bad');
      return;
    }
    gameState.setFlag(`vending_${gameState.day}`);
    gameState.addMood(2);
    this.ui.toast('售货机吐出一瓶冰红茶，心情 +2', 'good');
    audio.playSfx('confirm');
    this.host.persist();
  }

  private streetlight(): void {
    const off = !gameState.hasFlag('lights_off');
    gameState.setFlag('lights_off', off);
    this.ui.toast(off ? '路灯关掉了，校园一下子安静下来' : '路灯亮起，夜路好走多了', 'gold');
    audio.playSfx('confirm');
    this.host.refreshLights();
    this.host.persist();
  }

  private notice(): void {
    this.ui.openModal({
      title: '公告板',
      subtitle: '青海大学 · 像素校园 v0.1',
      body: `<p><b>今日通知</b>：西田径场附近出现了一只黑猫，猫协提醒大家不要投喂人类食物。</p>
        <p><b>操作</b>：WASD / 方向键移动，E 或空格互动，手机用左下摇杆 + 右下按钮。</p>
        <p><b>可用交互</b>：签到、上课、课程表、图书馆问答、座位提示、打饭、睡觉、撸猫、猫图鉴、宠物对战、躲猫猫、看台、售货机、路灯开关。</p>
        <p class="modal-note">当前为可玩原型：校园布局按青海大学公开地图的相对位置排布，细节仍在继续校正。</p>
        <div class="modal-actions"><button class="pixel-btn" id="notice-close">知道了</button></div>`,
    }).querySelector('#notice-close')?.addEventListener('click', () => this.ui.closeModal());
  }
}
