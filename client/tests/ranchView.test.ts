import { describe, expect, it } from 'vitest';
import { createRun, endWeek } from '../src/sim/run';
import { pendingEventFlag, pendingEventForRun, ranchSnapshot, weeklyAlert } from '../src/ui/ranchView';

describe('ranch decision preview', () => {
  it('uses species intake, seven days and ten percent loss, excluding dead animals', () => {
    const run = createRun(7);
    run.animals = [
      { ...run.animals[0], weightKg: 100 },
      { ...run.animals[20], weightKg: 50 },
      { ...run.animals[1], weightKg: 500, alive: false },
    ];
    const view = ranchSnapshot(run);
    expect(view.feedNeedKg).toBeCloseTo((100 * 0.025 + 50 * 0.035) * 7 * 1.1);
    expect(view.aliveCount).toBe(2);
  });

  it('deducts already consumed pasture before calculating the hay gap', () => {
    const run = createRun(7);
    const need = ranchSnapshot(run).feedNeedKg;
    run.grazedKg = need - 500;
    run.hayKg = 300;
    const view = ranchSnapshot(run);
    expect(view.feedRequiredHayKg).toBeCloseTo(500);
    expect(view.feedGapKg).toBeCloseTo(200);
    expect(view.hayAfterFeedingKg).toBe(0);
    expect(view.feedTone).toBe('bad');
  });

  it('matches actual feeding without changing the simulation state', () => {
    const run = createRun(7);
    const original = structuredClone(run);
    const view = ranchSnapshot(run);
    expect(run).toEqual(original);
    const settled = endWeek(run);
    expect(settled.weather).not.toBe('blizzard');
    expect(view.hayAfterFeedingKg).toBe(settled.hayKg);
  });

  it('never asks for negative hay when grazing exceeds demand', () => {
    const run = createRun(7);
    run.grazedKg = ranchSnapshot(run).feedNeedKg + 100;
    const view = ranchSnapshot(run);
    expect(view.feedRequiredHayKg).toBe(0);
    expect(view.feedGapKg).toBe(0);
    expect(view.hayAfterFeedingKg).toBe(run.hayKg);
  });

  it('keeps the empty-herd view finite and clear', () => {
    const run = createRun(7);
    run.animals = [];
    const view = ranchSnapshot(run);
    expect(view.feedNeedKg).toBe(0);
    expect(view.averageBcs).toBe(0);
    expect(view.headline).toBe('牧场暂无存栏');
  });

  it('现金恰等于固定费也提示将耗尽，且与实际维护口径一致', () => {
    const run = createRun(7);
    run.animals[0].collar = true;
    run.tech.collared = 100;
    run.money = 523;
    const view = ranchSnapshot(run);
    expect(view.weeklyCost).toBe(523);
    expect(view.cashAfterCosts).toBe(0);
    expect(view.cashAtRisk).toBe(true);
    expect(view.headline).toContain('现金将耗尽');
    expect(weeklyAlert(run).text).toContain('现金将耗尽');
    expect(weeklyAlert(run).tone).toBe('bad');
    run.actionsLeft = 0;
    expect(ranchSnapshot(run).hint).toContain('下周现金将为零');
    expect(ranchSnapshot(run).hint).not.toContain('结局');
    run.week = 13;
    expect(ranchSnapshot(run).hint).toContain('期末');
    run.money = 524;
    expect(ranchSnapshot(run).cashAtRisk).toBe(false);
  });
});

describe('pending weekly event projection', () => {
  it('restores an explicitly pending event and stops restoring after resolution', () => {
    const run = createRun(7);
    run.flags[pendingEventFlag(run.week, 'neighbour')] = true;
    expect(pendingEventForRun(run)?.id).toBe('neighbour');
    run.usedEvents.push('neighbour');
    expect(pendingEventForRun(run)).toBeNull();
  });

  it('does not replay old, invalid or completed-run events', () => {
    const run = createRun(7);
    run.flags[pendingEventFlag(run.week - 1, 'neighbour')] = true;
    expect(pendingEventForRun(run)).toBeNull();
    run.flags[pendingEventFlag(run.week, 'not-a-card')] = true;
    expect(pendingEventForRun(run)).toBeNull();
    run.flags[pendingEventFlag(run.week, 'neighbour')] = true;
    run.ended = true;
    expect(pendingEventForRun(run)).toBeNull();
  });
});

describe('横屏的本周风险入口', () => {
  it('先提示缺草，再提示患病，行动耗尽仍保留风险', () => {
    const run = createRun(7);
    run.hayKg = 0;
    run.animals[0].health = 'sick';
    run.actionsLeft = 0;
    expect(weeklyAlert(run).text).toContain('缺草');
    expect(weeklyAlert(run).text).toContain('行动已用完');
    expect(weeklyAlert(run).tone).toBe('bad');
    run.hayKg = ranchSnapshot(run).feedNeedKg + 100;
    expect(weeklyAlert(run).text).toContain('1 头患病');
    run.animals[0].health = 'healthy';
    expect(weeklyAlert(run)).toMatchObject({ tone: 'info' });
    expect(weeklyAlert(run).text).toContain('可结算');
  });

  it('空栏和完局具有明确入口，不显示虚假的正常经营提示', () => {
    const run = createRun(7);
    run.animals = [];
    expect(weeklyAlert(run).text).toContain('暂无存栏');
    run.ended = true;
    expect(weeklyAlert(run).text).toContain('本局已结束');
  });
});
