import { bus } from './emitter';
import { clone, createDefaultState, SPAWN } from './defaultState';
import { ensureTracking } from '../sim/history';
import {
  applyAction as applyRunAction,
  endWeek as endRunWeek,
  resolveEvent as resolveRunEvent,
  summarize,
  weekEvent as currentWeekEvent,
} from '../sim/run';
import type {
  Action,
  Animal,
  EventCard,
  PastureCell,
  RunState,
  RunSummary,
  ScenarioId,
} from '../sim/types';
import type { GameStateData, Season } from '../types';

export class GameState {
  private data: GameStateData = createDefaultState();

  get run(): RunState { return this.data.run; }
  get week(): number { return this.data.run.week; }
  get season(): Season { return this.data.run.season; }
  get money(): number { return this.data.run.money; }
  get hayKg(): number { return this.data.run.hayKg; }
  get labor(): number { return this.data.run.labor; }
  get reputation(): number { return this.data.run.reputation; }
  get actionsLeft(): number { return this.data.run.actionsLeft; }
  get animals(): Animal[] { return this.data.run.animals; }
  get pasture(): PastureCell[] { return this.data.run.pasture; }
  get ended(): boolean { return this.data.run.ended; }
  get ending(): RunState['ending'] { return this.data.run.ending; }
  get log(): RunState['log'] { return this.data.run.log; }
  get weather(): RunState['weather'] { return this.data.run.weather; }
  get settings() { return this.data.settings; }

  newGame(seed?: number, scenario: ScenarioId = 'year'): void {
    this.data = createDefaultState(seed, scenario);
    this.changed();
    bus.emit('calendar:changed', { week: this.week, season: this.season });
  }

  load(save: Partial<GameStateData>): void {
    const defaults = createDefaultState();
    this.data = {
      ...defaults,
      ...save,
      run: save.run ? ensureTracking(save.run) : defaults.run,
      settings: { ...defaults.settings, ...(save.settings ?? {}) },
      player: { ...defaults.player, ...(save.player ?? {}) },
    };
    this.changed();
  }

  setPlayer(x: number, y: number): void {
    this.data.player.x = Math.round(x);
    this.data.player.y = Math.round(y);
  }

  act(action: Action): void {
    this.data.run = applyRunAction(this.data.run, action);
    this.changed();
  }

  resolveEvent(cardId: string, choiceId: string): void {
    this.data.run = resolveRunEvent(this.data.run, cardId, choiceId);
    this.changed();
  }

  endWeek(): void {
    this.data.run = endRunWeek(this.data.run);
    this.changed();
    bus.emit('calendar:changed', { week: this.week, season: this.season });
  }

  weekEvent(): EventCard | null {
    return currentWeekEvent(this.data.run);
  }

  summary(): RunSummary {
    return summarize(this.data.run);
  }

  hasFlag(flag: string): boolean { return Boolean(this.data.run.flags[flag]); }

  setFlag(flag: string, value = true): void {
    this.data.run.flags[flag] = value;
    this.changed();
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
    if (this.data.run.ended) return '这一局结束了，看看结算吧';
    if (this.data.run.actionsLeft > 0) return `本周还剩 ${this.data.run.actionsLeft} 个行动点`;
    return '行动点用完了，结束本周进入下一周';
  }

  private changed(): void { bus.emit('state:changed'); }
}

export const gameState = new GameState();
