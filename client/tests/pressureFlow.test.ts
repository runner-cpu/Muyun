import { describe, expect, it } from 'vitest';
import { createRun } from '../src/sim/run';
import { reserveBudget } from '../src/sim/reserves';
import { pressureFlowMarkup, pressureFlowView } from '../src/ui/pressureFlow';

function oneYak() {
  const state = createRun(21);
  state.animals = [{ ...state.animals[0], species: 'yak', alive: true, weightKg: 200, collar: false }];
  state.labor = 1;
  state.tech = { collared: 0, vaccinated: false, scanned: false };
  state.grazedKg = 0;
  state.money = 10_000;
  return state;
}

describe('周初压力流向图', () => {
  it('只读储备账的库存路径，保留当周放牧抵扣与真实维护费', () => {
    const state = createRun(21);
    state.grazedKg = 600;
    state.animals[0].collar = true;
    state.tech.collared = 999;
    const before = structuredClone(state);
    const budget = reserveBudget(state);
    const view = pressureFlowView(state);

    expect(view.rows.map(row => row.week)).toEqual([1, 2, 3]);
    for (const [index, row] of view.rows.entries()) {
      const reference = budget.weeks[index];
      expect(row.hayNeedKg).toBe(reference.hayNeedKg);
      expect(row.stockGapKg).toBe(reference.stockGapKg);
      expect(row.stockAfterKg).toBe(reference.stockAfterKg);
      expect(row.availableKg + row.stockGapKg).toBeCloseTo(reference.hayNeedKg);
      expect(row.fixedCost).toBe(reference.fixedCost);
      expect(row.fixedCostsThroughWeek).toBe(budget.fixedCost * (index + 1));
    }
    expect(state).toEqual(before);
  });

  it('以当前周为第一次结算，局末不补造第二、第三行', () => {
    const state = oneYak();
    state.week = 12;
    state.season = 'winter';
    expect(pressureFlowView(state).rows.map(row => row.week)).toEqual([12, 13]);
    expect(pressureFlowMarkup(state)).toContain('含本周');
    expect(pressureFlowMarkup(state)).toContain('第 12 周');
    expect(pressureFlowMarkup(state)).not.toContain('第 14 周');
    state.week = 13;
    expect(pressureFlowView(state).rows.map(row => row.week)).toEqual([13]);
    state.ended = true;
    const markup = pressureFlowMarkup(state);
    expect(pressureFlowView(state).rows).toEqual([]);
    expect(markup).toContain('本局已结束');
    expect(markup).not.toContain('data-pressure-week=');
  });

  it('现金足够假设购草，也不抹掉现有库存的真实缺口', () => {
    const state = oneYak();
    state.hayKg = 0;
    const before = pressureFlowView(state);
    expect(before.rows[0].stockGapKg).toBeCloseTo(38.5);
    expect(before.rows[0].status).toBe('缺口');
    expect(reserveBudget(state).cashAfterTopUp).toBeGreaterThan(0);

    state.weather = 'blizzard';
    expect(pressureFlowView(state)).toEqual(before);
    const markup = pressureFlowMarkup(state);
    expect(markup).not.toContain('假设补足');
    expect(markup).toContain('仅用现有库存');
  });

  it('饲草以需求为比例，固定费独立按现款归一，不把元加到公斤', () => {
    const state = oneYak();
    state.hayKg = 19.25;
    state.money = 520;
    const [first, second, third] = pressureFlowView(state).rows;
    expect(first.availableKg).toBeCloseTo(19.25);
    expect(first.stockShare).toBeCloseTo(.5);
    expect(first.gapShare).toBeCloseTo(.5);
    expect(first.fixedShare).toBe(.5);
    expect(second.fixedShare).toBe(1);
    expect(third.fixedShare).toBe(1);
    expect(third.cashAfterFixed).toBe(-260);
    expect(pressureFlowMarkup(state)).toContain('固定费与现金单独计量');
  });

  it.each([
    [38.49, 10_000, '缺口'],
    [38.5, 10_000, '偏紧'],
    [39.5, 10_000, '充足'],
    [1_000, 259, '缺口'],
    [1_000, 260, '偏紧'],
    [1_000, 261, '充足'],
  ])('库存 %s kg、现金 %s 元时按真实缺口和零结余边界显示 %s', (hayKg, money, status) => {
    const state = oneYak();
    state.hayKg = hayKg;
    state.money = money;
    expect(pressureFlowView(state).rows[0].status).toBe(status);
  });

  it('空栏不用满条暗示饲草充足，仍保留人员与设备的固定支出', () => {
    const state = oneYak();
    state.animals[0].alive = false;
    state.hayKg = 0;
    const view = pressureFlowView(state);
    const markup = pressureFlowMarkup(state);
    expect(view.hasHerd).toBe(false);
    expect(view.rows).toHaveLength(3);
    expect(view.rows[0].fixedCost).toBe(260);
    expect(view.rows[0].status).toBe('充足');
    expect(view.rows.every(row => row.stockShare === 0 && row.gapShare === 0)).toBe(true);
    expect(markup).toContain('没有存活牲畜');
    expect(markup).toContain('固定费用仍会发生');
    expect(markup).not.toContain('饲草和固定费用均有结余');
    expect(markup).not.toContain('class="pressure-flow-hay-bar"');
  });

  it('本周放牧已覆盖需草时给出文字占位，未来仍有库存压力', () => {
    const state = oneYak();
    state.hayKg = 0;
    state.grazedKg = 100;
    const [current, next] = pressureFlowView(state).rows;
    expect(current.hayNeedKg).toBe(0);
    expect(current.stockShare).toBe(0);
    expect(current.gapShare).toBe(0);
    expect(next.stockGapKg).toBeCloseTo(38.5);
    const markup = pressureFlowMarkup(state);
    expect(markup).toContain('本周放牧已覆盖需草');
    expect(markup).not.toContain('NaN');
    expect(markup).not.toContain('Infinity');
  });
});
