import { bus } from '../core/emitter';
import { clone, createDefaultState, SPAWN } from '../core/defaultState';
import type { GameStateData } from '../types';

export class GameState {
  private data: GameStateData = createDefaultState();

  get day(): number { return this.data.day; }
  get timeMinutes(): number { return this.data.timeMinutes; }
  get credits(): number { return this.data.credits; }
  get mood(): number { return this.data.mood; }
  get cats(): string[] { return this.data.cats; }
  get achievements(): string[] { return this.data.achievements; }
  get flags(): Record<string, boolean> { return this.data.flags; }
  get settings() { return this.data.settings; }
  get hideAttempts(): number { return this.data.hideAttempts; }
  get hideDay(): number { return this.data.hideDay; }

  newGame(): void {
    this.data = createDefaultState();
    this.changed();
  }

  load(save: Partial<GameStateData>): void {
    const defaults = createDefaultState();
    this.data = {
      ...defaults,
      ...save,
      flags: { ...defaults.flags, ...(save.flags ?? {}) },
      cats: Array.isArray(save.cats) ? [...save.cats] : [],
      achievements: Array.isArray(save.achievements) ? [...save.achievements] : [],
      settings: { ...defaults.settings, ...(save.settings ?? {}) },
      player: { ...defaults.player, ...(save.player ?? {}) },
    };
    this.changed();
  }

  setTime(day: number, minutes: number): void {
    this.data.day = day;
    this.data.timeMinutes = minutes;
  }

  newDay(): void {
    this.data.day += 1;
    this.data.timeMinutes = 8 * 60;
    this.resetDailyCounters();
    this.changed();
  }

  autoNewDay(): void {
    this.data.day += 1;
    this.data.timeMinutes = 0;
    this.resetDailyCounters();
    this.changed();
  }

  private resetDailyCounters(): void {
    this.data.hideAttempts = 0;
    this.data.hideDay = this.data.day;
  }

  setPlayer(x: number, y: number): void {
    this.data.player.x = Math.round(x);
    this.data.player.y = Math.round(y);
  }

  addCredits(amount: number): void {
    this.data.credits = Math.max(0, this.data.credits + amount);
    this.changed();
  }

  addMood(amount: number): void {
    this.data.mood = Math.max(0, Math.min(100, this.data.mood + amount));
    this.changed();
  }

  hasFlag(flag: string): boolean { return Boolean(this.data.flags[flag]); }

  setFlag(flag: string, value = true): void {
    this.data.flags[flag] = value;
    this.changed();
  }

  hasCat(id: string): boolean { return this.data.cats.includes(id); }

  collectCat(id: string): boolean {
    if (this.hasCat(id)) return false;
    this.data.cats.push(id);
    this.data.flags[`cat_${id}`] = true;
    this.changed();
    return true;
  }

  unlockAchievement(id: string): boolean {
    if (this.data.achievements.includes(id)) return false;
    this.data.achievements.push(id);
    this.changed();
    return true;
  }

  beginHideAttempt(): boolean {
    if (this.data.hideDay !== this.data.day) {
      this.data.hideDay = this.data.day;
      this.data.hideAttempts = 0;
    }
    if (this.data.hideAttempts >= 3) return false;
    this.data.hideAttempts += 1;
    this.changed();
    return true;
  }

  signIn(): { ok: boolean; streak: number; reward: number } {
    if (this.data.lastSigninDay === this.data.day) {
      return { ok: false, streak: this.data.signinStreak, reward: 0 };
    }
    this.data.signinStreak = this.data.lastSigninDay === this.data.day - 1
      ? this.data.signinStreak + 1
      : 1;
    this.data.lastSigninDay = this.data.day;
    this.data.credits += 2;
    this.data.mood = Math.min(100, this.data.mood + 1);
    this.changed();
    return { ok: true, streak: this.data.signinStreak, reward: 2 };
  }

  setSettings(settings: Partial<GameStateData['settings']>): void {
    this.data.settings = { ...this.data.settings, ...settings };
    this.changed();
    bus.emit('audio:settings', this.data.settings);
  }

  toData(): GameStateData { return clone(this.data); }

  reset(): void {
    this.data = createDefaultState();
    this.changed();
  }

  getSpawn(): { x: number; y: number } {
    return this.data.player.x && this.data.player.y ? { ...this.data.player } : { ...SPAWN };
  }

  questText(): string {
    const day = this.data.day;
    if (!this.hasFlag(`class_${day}`)) return '去睿智楼上课，拿今天的第一笔学分';
    if (!this.hasFlag(`meal_${day}`)) return '去学生食堂打饭，顺便和阿姨聊两句';
    if (this.hasCat('orange') === false && this.cats.length === 0) return '在校园里找一只猫，猫是这所学校的隐藏主角';
    if (!this.achievements.includes('battle_first')) return '去西田径场找神秘训练师，试试宠物对战';
    if (!this.achievements.includes('hide_first')) return '找猫协的小满玩一局躲猫猫';
    return '随便逛逛吧，或者回宿舍睡觉进入下一天';
  }

  private changed(): void { bus.emit('state:changed'); }
}

export const gameState = new GameState();
