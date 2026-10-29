import { describe, expect, it } from 'vitest';
import { migrateSave } from '../src/systems/SaveSystem';
import { SAVE_VERSION } from '../src/config';
import { createDefaultState } from '../src/core/defaultState';

describe('save migration', () => {
  it('rejects empty input', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave('nope')).toBeNull();
  });

  it('migrates a legacy raw save into a fresh run', () => {
    const migrated = migrateSave({
      week: 4,
      money: 15000,
      hayKg: 640,
      flags: { first_snow: true },
      player: { x: 1, y: 2 },
    });
    expect(migrated?.version).toBe(SAVE_VERSION);
    expect(migrated?.data.run.week).toBe(1);
    expect(migrated?.data.run.animals.length).toBeGreaterThan(0);
    expect(migrated?.data.player.x).not.toBe(1);
  });

  it('keeps a current run intact', () => {
    const source = createDefaultState(4242);
    const migrated = migrateSave({ version: SAVE_VERSION, data: source });
    expect(migrated?.data.run.seed).toBe(4242);
    expect(migrated?.data.run.animals).toHaveLength(50);
    expect(migrated?.data.run.pasture).toHaveLength(4);
  });

  it('clamps corrupt run values', () => {
    const source = createDefaultState(7);
    source.run.week = 99;
    source.run.money = -5;
    source.run.hayKg = -20;
    source.run.labor = 99;
    source.run.reputation = 400;
    const migrated = migrateSave({ version: SAVE_VERSION, data: source });
    expect(migrated?.data.run.week).toBe(13);
    expect(migrated?.data.run.money).toBe(0);
    expect(migrated?.data.run.hayKg).toBe(0);
    expect(migrated?.data.run.labor).toBe(20);
    expect(migrated?.data.run.reputation).toBe(100);
  });

  it('falls back to a fresh run when the run payload is unusable', () => {
    const migrated = migrateSave({ version: SAVE_VERSION, data: { run: { week: 'x' } } });
    expect(migrated?.data.run.animals).toHaveLength(50);
    expect(migrated?.data.run.week).toBe(1);
  });

  it('refuses a future save version', () => {
    expect(migrateSave({ version: SAVE_VERSION + 1, data: {} })).toBeNull();
  });
});
