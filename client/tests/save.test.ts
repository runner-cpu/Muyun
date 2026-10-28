import { describe, expect, it } from 'vitest';
import { migrateSave } from '../src/systems/SaveSystem';
import { SAVE_VERSION } from '../src/config';

describe('save migration', () => {
  it('rejects empty input', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave('nope')).toBeNull();
  });

  it('migrates a legacy raw save and resets the old-map position', () => {
    const migrated = migrateSave({
      version: 0,
      day: 4,
      timeMinutes: 500,
      credits: 12,
      mood: 70,
      cats: ['black', 42],
      flags: { first_class: true, bad: 'yes' },
      player: { x: 1, y: 2 },
    });
    expect(migrated?.version).toBe(SAVE_VERSION);
    expect(migrated?.data.day).toBe(4);
    expect(migrated?.data.credits).toBe(12);
    expect(migrated?.data.cats).toEqual(['black']);
    expect(migrated?.data.flags).toEqual({ first_class: true });
    expect(migrated?.data.player.x).not.toBe(1);
    expect(migrated?.data.settings.music).toBeGreaterThan(0);
  });

  it('keeps a v5 position and clamps invalid values', () => {
    const migrated = migrateSave({
      version: 5,
      data: { day: -8, timeMinutes: 9999, mood: 900, credits: -4, player: { x: 333, y: 444 } },
    });
    expect(migrated?.data.day).toBe(1);
    expect(migrated?.data.timeMinutes).toBe(1439);
    expect(migrated?.data.mood).toBe(100);
    expect(migrated?.data.credits).toBe(0);
    expect(migrated?.data.player).toEqual({ x: 333, y: 444 });
  });

  it('refuses a future save version', () => {
    expect(migrateSave({ version: SAVE_VERSION + 1, data: {} })).toBeNull();
  });
});
