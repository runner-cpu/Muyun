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

  it('rejects a damaged current run instead of silently replacing its progress', () => {
    const migrated = migrateSave({ version: SAVE_VERSION, data: { run: { week: 'x' } } });
    expect(migrated).toBeNull();
  });

  it('refuses a future save version', () => {
    expect(migrateSave({ version: SAVE_VERSION + 1, data: {} })).toBeNull();
  });

  it('rejects duplicate identities, incomplete pasture and unsafe animal state', () => {
    const invalid = [
      (s: ReturnType<typeof createDefaultState>) => { s.run.animals[1].id = s.run.animals[0].id; },
      (s: ReturnType<typeof createDefaultState>) => { s.run.pasture.pop(); },
      (s: ReturnType<typeof createDefaultState>) => { s.run.pasture[1].id = 'P1'; },
      (s: ReturnType<typeof createDefaultState>) => { s.run.animals[0].health = 'unknown' as never; },
      (s: ReturnType<typeof createDefaultState>) => { s.run.animals[0].weightKg = -5; },
      (s: ReturnType<typeof createDefaultState>) => { s.run.animals[0].bcs = 9; },
      (s: ReturnType<typeof createDefaultState>) => { s.run.scenario = 'winter-challenge-v1'; },
    ];
    for (const mutate of invalid) {
      const source = createDefaultState(42);
      mutate(source);
      expect(migrateSave({ version: SAVE_VERSION, data: source })).toBeNull();
    }
  });

  it('discards malformed display logs without changing actual progress or valid escaped content', () => {
    const source = createDefaultState(42);
    source.run.log = [null, { week: 1, text: {}, tone: 'info' }, { week: 1, text: '<b>牧云</b>', tone: 'info' }] as never;
    const loaded = migrateSave({ version: SAVE_VERSION, data: source })!.data;
    expect(loaded.run.seed).toBe(42);
    expect(loaded.run.log).toEqual([{ week: 1, text: '<b>牧云</b>', tone: 'info' }]);
    expect(source.run.log).toHaveLength(3);
  });
});
