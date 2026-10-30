import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameState } from '../src/core/GameState';
import { createRun } from '../src/sim/run';
import { saveSystem } from '../src/systems/SaveSystem';
import { customHayQuote } from '../src/ui/panels/market';
import { actFromPanel } from '../src/ui/panels/panelActions';

vi.mock('../src/ui/instance', () => ({ ui: {} }));
afterEach(() => vi.restoreAllMocks());

describe('自定义购草', () => {
  it('为策略数量使用真实草价、现金缺口和行动禁用规则', () => {
    const state = createRun(44);
    expect(customHayQuote(state, '100')).toEqual({ kg: 100, cost: 176, reason: null });
    state.season = 'winter';
    state.weather = 'blizzard';
    state.money = 1400;
    const quote = customHayQuote(state, '300');
    expect(quote.cost).toBe(1440);
    expect(quote.reason).toContain('40');
    state.money = 1440;
    expect(customHayQuote(state, '300').reason).toBeNull();
    state.actionsLeft = 0;
    expect(customHayQuote(state, '300').reason).toContain('行动点已用完');
  });

  it('拒绝空值、非整数、非正数及非有限数量', () => {
    const state = createRun(44);
    for (const value of ['', ' ', '0', '-100', '1.5', 'Infinity', 'NaN', '9007199254740992']) {
      expect(customHayQuote(state, value).kg).toBeNull();
      expect(customHayQuote(state, value).reason).toContain('整数公斤数');
    }
  });

  it('非预设数量通过面板统一执行，一次购入只花一个行动点并保存', () => {
    gameState.newGame(44);
    vi.spyOn(saveSystem, 'save').mockReturnValue(true);
    const before = gameState.run;
    const quote = customHayQuote(before, '300');
    const refresh = vi.fn();
    expect(actFromPanel({ kind: 'buy-hay', kg: quote.kg! }, { toast: vi.fn() }, refresh)).toBe(true);
    expect(gameState.hayKg).toBe(before.hayKg + 300);
    expect(gameState.money).toBe(before.money - quote.cost);
    expect(gameState.actionsLeft).toBe(before.actionsLeft - 1);
    expect(saveSystem.save).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
