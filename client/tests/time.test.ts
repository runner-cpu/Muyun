import { describe, expect, it } from 'vitest';
import { formatTime, isCanteenOpen, isLibraryOpen, phaseFor, tintFor } from '../src/systems/TimeSystem';

describe('clock helpers', () => {
  it('formats minutes across midnight', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(8 * 60 + 5)).toBe('08:05');
    expect(formatTime(24 * 60 + 30)).toBe('00:30');
  });

  it('maps hours to four phases', () => {
    expect(phaseFor(5 * 60)).toBe('dawn');
    expect(phaseFor(9 * 60)).toBe('day');
    expect(phaseFor(18 * 60)).toBe('dusk');
    expect(phaseFor(23 * 60)).toBe('night');
    expect(phaseFor(2 * 60)).toBe('night');
  });

  it('applies canteen and library schedules', () => {
    expect(isCanteenOpen(12 * 60)).toBe(true);
    expect(isCanteenOpen(15 * 60)).toBe(false);
    expect(isCanteenOpen(18 * 60)).toBe(true);
    expect(isLibraryOpen(8 * 60)).toBe(true);
    expect(isLibraryOpen(22 * 60)).toBe(false);
  });

  it('returns a night tint and a transparent day tint', () => {
    expect(tintFor(12 * 60).alpha).toBe(0);
    expect(tintFor(23 * 60).alpha).toBeGreaterThan(0.2);
  });
});
