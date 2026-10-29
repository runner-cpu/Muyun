import { bus } from './emitter';
import { clone, createDefaultState, SPAWN } from './defaultState';
import { clampWeek, seasonForWeek } from '../systems/Calendar';
import type { GameStateData, Season } from '../types';

export class GameState {
  private data: GameStateData = createDefaultState();

  get week(): number { return this.data.week; }
  get season(): Season { return seasonForWeek(this.data.week); }
  get money(): number { return this.data.money; }
  get hayKg(): number { return this.data.hayKg; }
  get labor(): number { return this.data.labor; }
  get reputation(): number { return this.data.reputation; }
  get achievements(): string[] { return this.data.achievements; }
  get flags(): Record<string, boolean> { return this.data.flags; }
  get settings() { return this.data.settings; }

  newGame(): void {
    this.data = createDefaultState();
    this.changed();
  }

  load(save: Partial<GameStateData>): void {
    const defaults = createDefaultState();
    this.data = {
      ...defaults,
      ...save,
      week: clampWeek(save.week ?? defaults.week),
      flags: { ...defaults.flags, ...(save.flags ?? {}) },
      achievements: Array.isArray(save.achievements) ? [...save.achievements] : [],
      settings: { ...defaults.settings, ...(save.settings ?? {}) },
      player: { ...defaults.player, ...(save.player ?? {}) },
    };
    this.changed();
  }

  setPlayer(x: number, y: number): void {
    this.data.player.x = Math.round(x);
    this.data.player.y = Math.round(y);
  }

  addMoney(amount: number): void {
    this.data.money = Math.max(0, Math.round(this.data.money + amount));
    this.changed();
  }

  spend(amount: number): boolean {
    if (this.data.money < amount) return false;
    this.data.money = Math.round(this.data.money - amount);
    this.changed();
    return true;
  }

  addHay(kg: number): void {
    this.data.hayKg = Math.max(0, Math.round(this.data.hayKg + kg));
    this.changed();
  }

  consumeHay(kg: number): boolean {
    if (this.data.hayKg < kg) return false;
    this.data.hayKg = Math.round(this.data.hayKg - kg);
    this.changed();
    return true;
  }

  addReputation(delta: number): void {
    this.data.reputation = Math.max(0, Math.min(100, Math.round(this.data.reputation + delta)));
    this.changed();
  }

  setWeek(week: number): void {
    this.data.week = clampWeek(week);
    this.changed();
    bus.emit('calendar:changed', { week: this.data.week, season: this.season });
  }

  nextWeek(): number {
    this.setWeek(this.data.week + 1);
    return this.data.week;
  }

  hasFlag(flag: string): boolean { return Boolean(this.data.flags[flag]); }

  setFlag(flag: string, value = true): void {
    this.data.flags[flag] = value;
    this.changed();
  }

  unlockAchievement(id: string): boolean {
    if (this.data.achievements.includes(id)) return false;
    this.data.achievements.push(id);
    this.changed();
    return true;
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

  hintText(): string {
    if (this.data.week === 1) return '先看看畜群，再决定这一周怎么安排';
    if (this.data.reputation < 30) return '口碑偏低，收购商可能会压价';
    if (this.data.hayKg < 200 && this.season === 'winter') return '草料见底了，尽快补草';
    if (this.season === 'winter') return '冬天来了，撑过去就能结算这一局';
    return '点畜群、草场、集市或科技，安排本周的三个行动';
  }

  private changed(): void { bus.emit('state:changed'); }
}

export const gameState = new GameState();
