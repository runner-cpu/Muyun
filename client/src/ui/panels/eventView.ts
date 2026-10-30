import { actionLimit } from '../../sim/rules';
import { applyEffect } from '../../sim/runEffects';
import type { Effect, RunState } from '../../sim/types';
import { yuan } from './shared';

/** Describe the actual bounded state change, using the same effect as settlement. */
export function eventEffectSummary(state: RunState, effect: Effect): string {
  const after = { ...state, flags: { ...state.flags } };
  applyEffect(after, effect);
  const parts: string[] = [];
  const signed = (value: number) => `${value > 0 ? '+' : '−'}${Math.abs(value).toLocaleString('zh-CN')}`;
  if (after.money !== state.money) parts.push(`现金 ${after.money > state.money ? '+' : '−'}${yuan(Math.abs(after.money - state.money))}`);
  if (after.hayKg !== state.hayKg) parts.push(`干草 ${signed(after.hayKg - state.hayKg)} kg`);
  if (after.reputation !== state.reputation) parts.push(`口碑 ${signed(after.reputation - state.reputation)}`);
  if (after.labor !== state.labor) parts.push(`可用人手 ${signed(after.labor - state.labor)}，下周行动上限 ${actionLimit(after)} 点`);
  const living = state.animals.filter(animal => animal.alive);
  const remaining = after.animals.filter(animal => animal.alive);
  const departed = living.length - remaining.length;
  if (departed) parts.push(`${(effect.money ?? 0) > 0 ? '出栏' : '损失'} ${departed} 头`);
  const infected = remaining.filter(animal => animal.health === 'sick').length - living.filter(animal => animal.health === 'sick').length;
  if (infected > 0) parts.push(`新增症状 ${infected} 头`);
  if (effect.bcsDelta && remaining.length) {
    const previous = new Map(living.map(animal => [animal.id, animal.bcs]));
    const change = remaining.reduce((sum, animal) => sum + animal.bcs - previous.get(animal.id)!, 0) / remaining.length;
    if (Math.abs(change) > 0.00001) parts.push(`在栏平均 BCS ${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(2)}`);
  }
  if (effect.degradationDelta && state.pasture.length) {
    const change = after.pasture.reduce((sum, cell, index) => sum + cell.degradation - state.pasture[index].degradation, 0) / state.pasture.length;
    if (Math.abs(change) > 0.00001) parts.push(`平均退化 ${change > 0 ? '+' : '−'}${(Math.abs(change) * 100).toFixed(1)} 个百分点`);
  }
  return `即时变化：${parts.length ? parts.join('；') : '现金、草料与畜群不变'}。不占行动点。`;
}
