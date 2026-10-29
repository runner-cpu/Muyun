import { describe, expect, it } from 'vitest';
import { migrateSave } from '../src/systems/SaveSystem';
import { SAVE_VERSION } from '../src/config';

describe('save migration', () => {
  it('rejects empty input', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave('nope')).toBeNull();
  });

  it('migrates a legacy raw save and resets the old-world position', () => {
    const migrated = migrateSave({
      week: 4,
      money: 15000,
      hayKg: 640,
      labor: 3,
      reputation: 42,
      flags: { first_snow: true, bad: 'yes' },
      player: { x: 1, y: 2 },
    });
    expect(migrated?.version).toBe(SAVE_VERSION);
    expect(migrated?.data.week).toBe(4);
    expect(migrated?.data.money).toBe(15000);
    expect(migrated?.data.flags).toEqual({ first_snow: true });
    expect(migrated?.data.player.x).not.toBe(1);
    expect(migrated?.data.settings.music).toBeGreaterThan(0);
  });

  it('clamps out-of-range values', () => {
    const migrated = migrateSave({
      version: 1,
      data: { week: 99, money: -20, hayKg: -5, labor: 99, reputation: 400, player: { x: 333, y: 444 } },
    });
    expect(migrated?.data.week).toBe(13);
    expect(migrated?.data.money).toBe(0);
    expect(migrated?.data.hayKg).toBe(0);
    expect(migrated?.data.labor).toBe(20);
    expect(migrated?.data.reputation).toBe(100);
    expect(migrated?.data.player).toEqual({ x: 333, y: 444 });
  });

  it('refuses a future save version', () => {
    expect(migrateSave({ version: SAVE_VERSION + 1, data: {} })).toBeNull();
  });
});
