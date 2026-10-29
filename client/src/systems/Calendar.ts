import { WEEKS_PER_RUN } from '../config';
import type { Season } from '../types';

export function clampWeek(week: number): number {
  return Math.max(1, Math.min(WEEKS_PER_RUN, Math.floor(week)));
}

/** Spring 1-3, summer 4-6, autumn 7-9, winter 10-13. */
export function seasonForWeek(week: number): Season {
  const w = clampWeek(week);
  if (w <= 3) return 'spring';
  if (w <= 6) return 'summer';
  if (w <= 9) return 'autumn';
  return 'winter';
}

export function seasonLabel(season: Season): string {
  return { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' }[season];
}

export function seasonGlyph(season: Season): string {
  return { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }[season];
}

/** Whole-scene colour wash, reused by the ranch scene every week. */
export function tintForSeason(season: Season): { color: number; alpha: number } {
  if (season === 'spring') return { color: 0x9fd3a0, alpha: 0.05 };
  if (season === 'summer') return { color: 0xffe9a8, alpha: 0.04 };
  if (season === 'autumn') return { color: 0xe8a15f, alpha: 0.09 };
  return { color: 0x9fc4e8, alpha: 0.16 };
}

export function weekLabel(week: number): string {
  return `第 ${clampWeek(week)} 周`;
}

export function runProgress(week: number): number {
  return clampWeek(week) / WEEKS_PER_RUN;
}
