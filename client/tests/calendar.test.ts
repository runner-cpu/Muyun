import { describe, expect, it } from 'vitest';
import {
  clampWeek,
  runProgress,
  seasonForWeek,
  seasonGlyph,
  seasonLabel,
  tintForSeason,
  weekLabel,
} from '../src/systems/Calendar';

describe('pastoral calendar', () => {
  it('maps thirteen weeks onto four seasons', () => {
    expect(seasonForWeek(1)).toBe('spring');
    expect(seasonForWeek(3)).toBe('spring');
    expect(seasonForWeek(4)).toBe('summer');
    expect(seasonForWeek(6)).toBe('summer');
    expect(seasonForWeek(7)).toBe('autumn');
    expect(seasonForWeek(9)).toBe('autumn');
    expect(seasonForWeek(10)).toBe('winter');
    expect(seasonForWeek(13)).toBe('winter');
  });

  it('clamps weeks to a single run', () => {
    expect(clampWeek(0)).toBe(1);
    expect(clampWeek(-4)).toBe(1);
    expect(clampWeek(99)).toBe(13);
    expect(clampWeek(6.9)).toBe(6);
  });

  it('labels seasons and weeks', () => {
    expect(seasonLabel('spring')).toBe('春季');
    expect(seasonLabel('winter')).toBe('冬季');
    expect(seasonGlyph('autumn')).toBe('秋');
    expect(weekLabel(5)).toBe('第 5 周');
    expect(weekLabel(99)).toBe('第 13 周');
  });

  it('keeps colour washes subtle enough to read the scene', () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const tint = tintForSeason(season);
      expect(tint.alpha).toBeGreaterThanOrEqual(0);
      expect(tint.alpha).toBeLessThan(0.25);
    }
    expect(tintForSeason('winter').alpha).toBeGreaterThan(tintForSeason('summer').alpha);
  });

  it('reports run progress in a 0..1 range', () => {
    expect(runProgress(13)).toBe(1);
    expect(runProgress(1)).toBeCloseTo(1 / 13);
    expect(runProgress(0)).toBeCloseTo(1 / 13);
  });
});
