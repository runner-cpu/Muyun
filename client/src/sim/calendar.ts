import type { Season } from './types';

/** One run is a single pastoral year, compressed to thirteen weeks. */
export const WEEKS_PER_RUN = 13;

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
