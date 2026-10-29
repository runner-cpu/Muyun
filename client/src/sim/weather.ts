import type { Rng } from './rng';
import type { Weather } from './types';

/** Weeks 10-13 are the winter disaster window. */
export function snowRisk(week: number): number {
  const w = Math.max(1, Math.min(13, Math.floor(week)));
  if (w <= 6) return 0.02;
  if (w <= 9) return 0.08;
  return 0.35;
}

export function drawWeather(week: number, rng: Rng): Weather {
  const risk = snowRisk(week);
  const roll = rng();
  if (roll < risk) return 'blizzard';
  if (roll < risk + 0.18) return 'snow';
  if (roll < risk + 0.33) return 'wind';
  return 'clear';
}

export function isDisaster(weather: Weather): boolean {
  return weather === 'blizzard';
}

export function weatherLabel(weather: Weather): string {
  return { clear: '晴', wind: '大风', snow: '降雪', blizzard: '暴雪' }[weather];
}
