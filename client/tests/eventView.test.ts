import { describe, expect, it } from 'vitest';
import { createRun } from '../src/sim/run';
import { eventEffectSummary } from '../src/ui/panels/eventView';

describe('事件决策的实际代价', () => {
  it('展示现金、储草和出栏变化，预览不改动源状态', () => {
    const state = createRun(70);
    const before = JSON.stringify(state);
    expect(eventEffectSummary(state, { money: -800, hayKg: 400, flag: 'prepared' })).toContain('现金 −¥800；干草 +400 kg');
    expect(eventEffectSummary(state, { money: 1000, loseAnimals: 2 })).toContain('出栏 2 头');
    expect(eventEffectSummary(state, { loseAnimals: 2 })).toContain('损失 2 头');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('披露真实有界变化和人员对下周行动的影响', () => {
    const state = createRun(70);
    state.reputation = 99;
    state.labor = 3;
    state.animals = [{ ...state.animals[0], bcs: 1.1 }];
    const summary = eventEffectSummary(state, { reputation: 5, labor: -1, bcsDelta: -0.4 });
    expect(summary).toContain('口碑 +1');
    expect(summary).toContain('下周行动上限 3 点');
    expect(summary).toContain('BCS −0.10');
  });
});
