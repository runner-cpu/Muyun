import { seasonForWeek, WEEKS_PER_RUN } from './calendar';
import { hayPricePerKg, weeklyCosts } from './economy';
import { feedRequirementKg } from './nutrition';
import type { RunState, Season } from './types';

export interface ReserveWeek {
  week: number;
  season: Season;
  hayNeedKg: number;
  /** Stock-only path; hypothetical purchases never make this gap disappear. */
  stockGapKg: number;
  stockAfterKg: number;
  topUpKg: number;
  topUpCost: number;
  fixedCost: number;
  cashAfterTopUp: number;
}

/** A static stock budget, not a forecast or an executable strategy. No state changes. */
export function reserveBudget(state: RunState) {
  const herd = state.animals.filter(animal => animal.alive);
  const weeklyNeedKg = feedRequirementKg(herd);
  const fixedCost = weeklyCosts(state.labor, {
    ...state.tech, collared: herd.filter(animal => animal.collar).length,
  });
  const remainingWeeks = state.ended ? 0 : Math.max(0, WEEKS_PER_RUN - state.week + 1);
  let stockHay = state.hayKg;
  let budgetHay = state.hayKg;
  let cash = state.money;
  const weeks: ReserveWeek[] = [];
  for (let offset = 0; offset < Math.min(3, remainingWeeks); offset++) {
    const week = state.week + offset;
    const season = seasonForWeek(week);
    const hayNeedKg = Math.max(0, weeklyNeedKg - (offset === 0 ? state.grazedKg : 0));
    const stockGapKg = Math.max(0, hayNeedKg - stockHay);
    stockHay = Math.round(Math.max(0, stockHay - hayNeedKg));
    // Model whole-kg purchases and settlement rounding using a separate path.
    const topUpKg = Math.ceil(Math.max(0, hayNeedKg - budgetHay));
    const topUpCost = Math.round(topUpKg * hayPricePerKg(season, offset === 0 && state.weather === 'blizzard'));
    budgetHay = Math.round(Math.max(0, budgetHay + topUpKg - hayNeedKg));
    cash -= topUpCost + fixedCost;
    weeks.push({ week, season, hayNeedKg, stockGapKg, stockAfterKg: stockHay, topUpKg, topUpCost, fixedCost, cashAfterTopUp: cash });
  }
  return {
    weeklyNeedKg, fixedCost, remainingWeeks, weeks,
    fixedCostsRemaining: fixedCost * remainingWeeks,
    firstStockGapWeek: weeks.find(week => week.stockGapKg > 0)?.week ?? null,
    topUpTotal: weeks.reduce((total, week) => total + week.topUpCost, 0),
    fixedTotal: fixedCost * weeks.length,
    cashAfterTopUp: cash,
  };
}
