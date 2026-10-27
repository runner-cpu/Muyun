import { DAY_REAL_SECONDS } from '../config';
import { bus } from '../core/emitter';
import type { GameState } from '../core/GameState';
import type { DayPhase } from '../types';

export function formatTime(minutes: number): string {
  const total = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function phaseFor(minutes: number): DayPhase {
  const h = minutes / 60;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

export function phaseLabel(phase: DayPhase): string {
  return { dawn: '清晨', day: '白天', dusk: '黄昏', night: '夜晚' }[phase];
}

export function tintFor(minutes: number): { color: number; alpha: number } {
  const phase = phaseFor(minutes);
  if (phase === 'dawn') return { color: 0xffb37a, alpha: 0.13 };
  if (phase === 'dusk') return { color: 0xff8a5c, alpha: 0.17 };
  if (phase === 'night') return { color: 0x111a3a, alpha: 0.46 };
  return { color: 0xffffff, alpha: 0 };
}

export function isCanteenOpen(minutes: number): boolean {
  return (minutes >= 11 * 60 + 30 && minutes < 13 * 60 + 30)
    || (minutes >= 17 * 60 + 30 && minutes < 19 * 60 + 30);
}

export function isLibraryOpen(minutes: number): boolean {
  return minutes >= 8 * 60 && minutes < 22 * 60;
}

export class TimeSystem {
  private carry = 0;
  private lastEmittedMinute = -1;
  paused = false;

  constructor(private state: GameState) {}

  update(deltaMs: number): void {
    if (this.paused) return;
    const gameMinutes = deltaMs / ((DAY_REAL_SECONDS * 1000) / 1440);
    this.carry += gameMinutes;
    if (this.carry < 1) return;
    const whole = Math.floor(this.carry);
    this.carry -= whole;
    let minutes = this.state.timeMinutes + whole;
    while (minutes >= 1440) {
      minutes -= 1440;
      this.state.autoNewDay();
    }
    this.state.setTime(this.state.day, minutes);
    if (this.state.timeMinutes !== this.lastEmittedMinute) {
      this.lastEmittedMinute = this.state.timeMinutes;
      this.emit();
    }
  }

  sleep(): void {
    this.state.newDay();
    this.carry = 0;
    this.emit();
  }

  get phase(): DayPhase { return phaseFor(this.state.timeMinutes); }

  get clock(): { day: number; minutes: number; phase: DayPhase } {
    return { day: this.state.day, minutes: this.state.timeMinutes, phase: this.phase };
  }

  emit(): void {
    bus.emit('time:changed', this.clock);
  }
}
