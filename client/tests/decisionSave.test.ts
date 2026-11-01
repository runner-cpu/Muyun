import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultState } from '../src/core/defaultState';
import { migrateSave, saveSystem } from '../src/systems/SaveSystem';
import { applyAction, endWeek } from '../src/sim/run';
import { createWinterChallenge } from '../src/sim/scenarios';
import { exportRun, replayRun } from '../src/sim/replay';
import { captureMetrics } from '../src/sim/history';
import { SIM_VERSION } from '../src/sim/types';
import { actionStatus } from '../src/sim/rules';
import { comparePolicies } from '../src/sim/policies';
import { SAVE_KEY } from '../src/config';

describe('decision recording and isolated saves', () => {
  beforeEach(() => {
    const records = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
      removeItem: (key: string) => records.delete(key),
    });
    saveSystem.setMode('year');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('continues an old v2 run from its real state without inventing history', () => {
    const old = createDefaultState(4242);
    delete old.run.tracking;
    old.run.week = 7;
    old.run.season = 'autumn';
    old.run.money = 6000;
    const loaded = migrateSave({ version: 2, data: old })!.data.run;
    expect(loaded.week).toBe(7);
    expect(loaded.money).toBe(6000);
    expect(loaded.tracking?.provenance).toBe('continued');
    expect(loaded.tracking?.baseline.week).toBe(7);
    expect(loaded.tracking?.weeks).toEqual([]);
  });
  it('round-trips additional action capacity and recorded decisions', () => {
    const data = createDefaultState(4242);
    data.run = endWeek(applyAction(data.run, { kind: 'hire' }));
    data.run = applyAction(data.run, { kind: 'graze', cellId: 'P1' });
    const loaded = migrateSave(JSON.parse(JSON.stringify({ version: 2, data })))!.data.run;
    expect(loaded.actionsLeft).toBe(3);
    expect(loaded.tracking?.weeks).toHaveLength(1);
    expect(loaded.tracking?.pending).toHaveLength(1);
    expect(captureMetrics(replayRun(exportRun(loaded)))).toEqual(captureMetrics(loaded));
    data.run = endWeek(data.run);
    expect(migrateSave({ version: 2, data })!.data.run.actionsLeft).toBe(4);
  });
  it('preserves a current-week hay harvest through save and replay', () => {
    const data = createDefaultState(4242);
    data.run = applyAction(data.run, { kind: 'cut-hay', cellId: 'P1' });
    const loaded = migrateSave(JSON.parse(JSON.stringify({ version: 2, data })))!.data.run;
    expect(loaded.pasture[0]).toMatchObject({ harvested: true, restedWeeks: 0 });
    expect(actionStatus(loaded, { kind: 'graze', cellId: 'P1' }).reason).toContain('已经使用');
    const replayed = replayRun(exportRun(loaded));
    expect(replayed.pasture[0].harvested).toBe(true);
    expect(captureMetrics(replayed)).toEqual(captureMetrics(loaded));
  });
  it('round-trips a pristine fixed challenge without changing its run or recorded origin', () => {
    const data = { ...createDefaultState(1), run: createWinterChallenge() };
    const loaded = migrateSave(JSON.parse(JSON.stringify({ version: 2, data })))!.data;
    expect(loaded.run).toEqual(data.run);
    expect(loaded.run.pasture.every(cell => cell.harvested === false)).toBe(true);
  });
  it('upgrades old simulation tracking at the actual resumed state without mixing rule histories', () => {
    const data = createDefaultState(4242);
    data.run = endWeek(applyAction(data.run, { kind: 'graze', cellId: 'P1' }));
    data.run = applyAction(data.run, { kind: 'cut-hay', cellId: 'P2' });
    data.run.tracking!.version = 'decision-v1';
    delete data.run.pasture[1].harvested;
    const before = JSON.stringify(data);
    const loaded = migrateSave({ version: 2, data })!.data.run;
    expect(captureMetrics(loaded)).toEqual(captureMetrics(data.run));
    expect(loaded.actionsLeft).toBe(data.run.actionsLeft);
    expect(loaded.animals).toEqual(data.run.animals);
    expect(loaded.tracking).toMatchObject({ version: SIM_VERSION, provenance: 'continued', weeks: [], pending: [] });
    expect(loaded.tracking!.baseline).toEqual(captureMetrics(loaded));
    expect(loaded.tracking!.origin.week).toBe(loaded.week);
    expect(loaded.tracking!.origin.hayKg).toBe(loaded.hayKg);
    expect(loaded.tracking!.origin.pasture[1]).toMatchObject({ harvested: true, restedWeeks: 0 });
    expect(loaded.log.at(-1)!.text).toContain('旧规则历史不参与');
    expect(actionStatus(loaded, { kind: 'graze', cellId: 'P2' }).reason).toContain('已经使用');
    expect(captureMetrics(replayRun(exportRun(loaded)))).toEqual(captureMetrics(loaded));
    expect(JSON.stringify(data)).toBe(before);
    const reloaded = migrateSave({ version: 2, data: { ...data, run: loaded } })!.data.run;
    expect(reloaded.log.filter(entry => entry.text.includes('模拟规则已升级'))).toHaveLength(1);
  });
  it('refuses a replay from the previous simulation version explicitly', () => {
    const payload = JSON.parse(exportRun(createDefaultState(4242).run));
    payload.simulationVersion = 'decision-v1';
    expect(() => replayRun(payload)).toThrow('模拟版本不同');
  });
  it('preserves known grazing and harvest use when upgrading absent physical flags', () => {
    const data = createDefaultState(4242);
    data.run = applyAction(data.run, { kind: 'graze', cellId: 'P1' });
    data.run = applyAction(data.run, { kind: 'cut-hay', cellId: 'P2' });
    data.run.tracking!.version = 'decision-v1';
    data.run.pasture[0].grazing = false;
    delete data.run.pasture[1].harvested;
    const loaded = migrateSave({ version: 2, data })!.data.run;
    expect(captureMetrics(loaded)).toEqual(captureMetrics(data.run));
    expect(loaded.actionsLeft).toBe(1);
    expect(loaded.pasture[0]).toMatchObject({ grazing: true, harvested: false, restedWeeks: 0 });
    expect(loaded.pasture[1]).toMatchObject({ grazing: false, harvested: true, restedWeeks: 0 });
    expect(loaded.tracking!.pending).toEqual([]);
    for (const cellId of ['P1', 'P2']) expect(actionStatus(loaded, { kind: 'cut-hay', cellId }).reason).toContain('已经使用');
    const nextWeek = endWeek(loaded);
    expect(nextWeek.pasture.slice(0, 2).every(cell => cell.restedWeeks === 0)).toBe(true);
    expect(actionStatus(nextWeek, { kind: 'cut-hay', cellId: 'P1' }).reason).toBeNull();
  });
  it('keeps a completed old-rule run as an honest snapshot with its physical outcome intact', () => {
    const data = { ...createDefaultState(1), run: createWinterChallenge() };
    while (!data.run.ended) data.run = endWeek(data.run);
    data.run.tracking!.version = 'decision-v1';
    const loaded = migrateSave({ version: 2, data })!.data.run;
    expect(captureMetrics(loaded)).toEqual(captureMetrics(data.run));
    expect(loaded.ended).toBe(true);
    expect(loaded.ending).toBe(data.run.ending);
    expect(loaded.actionsLeft).toBe(data.run.actionsLeft);
    expect(loaded.animals).toEqual(data.run.animals);
    expect(loaded.pasture).toEqual(data.run.pasture);
    expect(loaded.usedEvents).toEqual(data.run.usedEvents);
    expect(loaded.flags).toEqual(data.run.flags);
    expect(loaded.tracking).toMatchObject({ version: SIM_VERSION, provenance: 'continued', weeks: [], pending: [] });
    expect(loaded.tracking!.origin.ended).toBe(true);
    expect(loaded.log.at(-1)!.text).toContain('本局已结束，保留当前状态快照');
    expect(comparePolicies(loaded).available).toBe(false);
    const payload = JSON.parse(exportRun(loaded));
    expect(payload.source.kind).toBe('snapshot');
    expect(captureMetrics(replayRun(payload))).toEqual(captureMetrics(loaded));
    const reloaded = migrateSave({ version: 2, data: { ...data, run: loaded } })!.data.run;
    expect(reloaded).toEqual(loaded);
  });
  it('keeps the full run when replacing or clearing a challenge', () => {
    const year = createDefaultState(777);
    expect(saveSystem.save(year)).toBe(true);
    const challenge = { ...createDefaultState(1), run: createWinterChallenge() };
    expect(saveSystem.save(challenge)).toBe(true);
    expect(saveSystem.load('year')!.run.seed).toBe(777);
    expect(saveSystem.load('winter-challenge-v1')!.run.week).toBe(10);
    saveSystem.clear('winter-challenge-v1');
    expect(saveSystem.load('winter-challenge-v1')).toBeNull();
    expect(saveSystem.load('year')!.run.seed).toBe(777);
  });
  it('drops corrupt tracking while retaining current progress', () => {
    const data = createDefaultState(123);
    data.run.week = 5;
    const raw = JSON.parse(JSON.stringify({ version: 2, data }));
    raw.data.run.tracking.pending = [{ kind: 'unrecognized' }];
    const loaded = migrateSave(raw)!.data.run;
    expect(loaded.week).toBe(5);
    expect(loaded.tracking?.provenance).toBe('continued');
    expect(loaded.tracking?.pending).toEqual([]);
  });

  it('does not accept a year run in the winter slot or overwrite damaged bytes when loading', () => {
    const year = createDefaultState(123);
    const raw = JSON.stringify({ version: 2, data: year });
    localStorage.setItem(`${SAVE_KEY}-winter`, raw);
    expect(saveSystem.load('winter-challenge-v1')).toBeNull();
    expect(localStorage.getItem(`${SAVE_KEY}-winter`)).toBe(raw);
    const damaged = '{"version":2,"data":{"run":{"week":"x"}}}';
    localStorage.setItem(SAVE_KEY, damaged);
    expect(saveSystem.load('year')).toBeNull();
    expect(saveSystem.exists('year')).toBe(true);
    expect(localStorage.getItem(SAVE_KEY)).toBe(damaged);
  });
});
