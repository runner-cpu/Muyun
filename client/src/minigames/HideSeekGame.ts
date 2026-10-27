import { gameState } from '../core/GameState';
import type { HideSpot } from '../types';
import type { UIManager } from '../ui/UIManager';
import { audio } from '../systems/AudioManager';

export type InspectResult = 'win' | 'wrong' | 'inactive';

export class HideSeekGame {
  private target: HideSpot | null = null;
  private active = false;
  private secondsLeft = 0;

  constructor(
    private ui: UIManager,
    private spots: HideSpot[],
    private onActiveChange: (active: boolean) => void,
  ) {}

  isActive(): boolean { return this.active; }
  getTargetId(): string | null { return this.target?.id ?? null; }

  start(): 'started' | 'limit' | 'already' {
    if (this.active) return 'already';
    if (this.spots.length === 0) return 'limit';
    if (!gameState.beginHideAttempt()) {
      this.ui.toast('今天已经玩过 3 次躲猫猫了，明天再来吧', 'bad');
      return 'limit';
    }
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
    this.target = this.spots[Math.floor(random * this.spots.length)];
    this.active = true;
    this.secondsLeft = 90;
    this.ui.showSeek();
    this.ui.updateSeek(this.secondsLeft, '很冷', 1);
    this.ui.toast(`躲猫猫开始！剩余机会 ${3 - gameState.hideAttempts} 次`, 'gold');
    this.onActiveChange(true);
    audio.playSfx('confirm');
    return 'started';
  }

  update(deltaMs: number, playerX: number, playerY: number): void {
    if (!this.active || !this.target) return;
    this.secondsLeft -= deltaMs / 1000;
    if (this.secondsLeft <= 0) {
      this.secondsLeft = 0;
      this.finish(false);
      return;
    }
    const dist = Math.hypot(this.target.tx * 16 + 8 - playerX, this.target.ty * 16 + 8 - playerY);
    const hint = dist > 700 ? '很冷' : dist > 450 ? '冷' : dist > 280 ? '有点暖' : dist > 150 ? '热' : dist > 70 ? '很热' : '就在附近';
    this.ui.updateSeek(this.secondsLeft, hint, this.secondsLeft / 90);
  }

  inspect(spotId: string): InspectResult {
    if (!this.active || !this.target) return 'inactive';
    if (spotId === this.target.id) {
      this.finish(true);
      return 'win';
    }
    this.ui.toast('这里没有，换个地方找找', 'bad', 1300);
    audio.playSfx('cancel');
    return 'wrong';
  }

  cancel(): void {
    if (this.active) this.finish(false, true);
  }

  private finish(win: boolean, silent = false): void {
    this.active = false;
    this.target = null;
    this.ui.hideSeek();
    if (win) {
      gameState.addMood(10);
      const first = gameState.unlockAchievement('hide_first');
      this.ui.toast(first ? '找到啦！成就解锁：捉迷藏大师 · 心情 +10' : '找到啦！心情 +10', 'good', 2400);
      audio.playSfx('win');
    } else if (!silent) {
      this.ui.toast('时间到，猫协同学从藏身处探出了头。明天再来吧', 'bad', 2400);
      audio.playSfx('lose');
    }
    this.onActiveChange(false);
  }
}
