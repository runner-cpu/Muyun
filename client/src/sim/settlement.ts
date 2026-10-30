import { applyWeeklyGrowth } from './animal';
import { weeklyCosts } from './economy';
import { feedRatio, feedRequirementKg } from './nutrition';
import { rest } from './pasture';
import { pastureUse } from './rules';
import type { RunState } from './types';

/** Visible deterministic phases only. Calendar, weather and disease are excluded. */
export function settleDeterministic(state: RunState): RunState {
  const herd = state.animals.filter(a => a.alive);
  const need = feedRequirementKg(herd);
  const ratio = feedRatio(state.grazedKg + state.hayKg, need);
  const hayUsed = Math.min(state.hayKg, Math.max(0, need - state.grazedKg));
  const tech = { ...state.tech, collared: herd.filter(a => a.collar).length };
  const log = [...state.log];
  if (ratio < .85) log.push({ week: state.week, text: `草料不足，采食率 ${Math.round(ratio * 100)}%`, tone: 'bad' });
  return { ...state,
    hayKg: Math.round(state.hayKg - hayUsed),
    animals: state.animals.map(a => ({ ...applyWeeklyGrowth(a, ratio), ageWeeks: a.ageWeeks + 1 })),
    pasture: state.pasture.map(cell => pastureUse(state, cell) !== 'resting'
      ? { ...cell, grazing: false, harvested: false, restedWeeks: 0 }
      : rest(cell, state.season)),
    money: Math.max(0, state.money - weeklyCosts(state.labor, tech)),
    tech, log,
  };
}
