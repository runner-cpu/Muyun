import { describe, expect, it, vi } from 'vitest';
import { createRun } from '../src/sim/run';
import { reserveBudget } from '../src/sim/reserves';
import { settleDeterministic } from '../src/sim/settlement';
import { feedRequirementKg } from '../src/sim/nutrition';
import { reserveMarkup, reserveSummary } from '../src/ui/panels/reserves';

vi.mock('../src/ui/instance', () => ({ ui: {} }));

describe('三周储备账', () => {
  it('首周耗草和固定费与确定性结算一致，不修改真实状态', () => {
    const state = createRun(21);
    state.grazedKg = 600;
    state.animals[0].collar = true;
    state.tech.collared = 999; // Recompute upkeep from living records, as settlement does.
    const original = structuredClone(state);
    const budget = reserveBudget(state);
    const settled = settleDeterministic(state);
    expect(budget.weeks[0].stockAfterKg).toBe(settled.hayKg);
    expect(budget.weeks[0].fixedCost).toBe(state.money - settled.money);
    expect(budget.weeks[0].hayNeedKg).toBeCloseTo(feedRequirementKg(state.animals) - 600);
    expect(state).toEqual(original);
  });

  it('本周放牧不能重复抵扣未来，库存与假设购草使用独立路径', () => {
    const state = createRun(21);
    state.grazedKg = feedRequirementKg(state.animals);
    state.hayKg = 0;
    const budget = reserveBudget(state);
    expect(budget.weeks[0].stockGapKg).toBe(0);
    expect(budget.weeks[1].stockGapKg).toBeCloseTo(budget.weeklyNeedKg);
    expect(budget.weeks[2].stockGapKg).toBeCloseTo(budget.weeklyNeedKg);
    expect(budget.weeks[1].topUpKg).toBe(Math.ceil(budget.weeklyNeedKg));
    expect(budget.firstStockGapWeek).toBe(2);
  });

  it('跨入冬季使用冬季价格，未知未来不套用当前暴雪翻倍', () => {
    const state = createRun(21);
    state.week = 9;
    state.season = 'autumn';
    state.weather = 'blizzard';
    state.hayKg = 0;
    const budget = reserveBudget(state);
    expect(budget.weeks.map(week => week.season)).toEqual(['autumn', 'winter', 'winter']);
    expect(budget.weeks[0].topUpCost).toBe(Math.round(budget.weeks[0].topUpKg * 3.2));
    expect(budget.weeks[1].topUpCost).toBe(Math.round(budget.weeks[1].topUpKg * 2.4));
    expect(budget.weeks[2].topUpCost).toBe(Math.round(budget.weeks[2].topUpKg * 2.4));
  });

  it('不越过13周，结束后不补造未来，空栏仍有固定开支', () => {
    const state = createRun(21);
    state.week = 13;
    state.season = 'winter';
    state.animals = [];
    const budget = reserveBudget(state);
    expect(budget.weeks).toHaveLength(1);
    expect(budget.weeklyNeedKg).toBe(0);
    expect(budget.weeks[0].fixedCost).toBeGreaterThan(0);
    expect(budget.topUpTotal).toBe(0);
    state.ended = true;
    expect(reserveBudget(state).weeks).toEqual([]);
    expect(reserveSummary(state)).toContain('本局已结束');
  });

  it('保留负现金压力但不执行购买，清楚区分静态预算和实际经营', () => {
    const state = createRun(21);
    state.money = 0;
    state.hayKg = 0;
    state.actionsLeft = 0;
    const markup = reserveMarkup(state);
    expect(reserveBudget(state).cashAfterTopUp).toBeLessThan(0);
    expect(markup).toContain('当前现金还差');
    expect(markup).toContain('不会自动购买或改变牧场');
    expect(markup).toContain('还需核对行动点');
    expect(state.hayKg).toBe(0);
    expect(state.money).toBe(0);
  });

  it('出售后始终使用记录起点的保留下限，并标明非最终达标', () => {
    const state = createRun(21);
    const floor = state.tracking!.baseline.sheepUnits * .5;
    state.animals = state.animals.map((animal, index) => ({ ...animal, alive: index === 0 }));
    const markup = reserveMarkup(state);
    expect(markup).toContain(`≥ ${floor.toFixed(1)}`);
    expect(markup).toContain('距离下限还差');
    expect(markup).toContain('最高成果在局末判断');
    expect(markup).toContain('不能随每周出售逐步下调');
  });
});
