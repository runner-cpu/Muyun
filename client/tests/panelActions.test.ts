import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gameState } from '../src/core/GameState';
import { createRun } from '../src/sim/run';
import { saveSystem } from '../src/systems/SaveSystem';
import { actFromPanel, actionStatus } from '../src/ui/panels/panelActions';

describe('经营操作预检', () => {
  it('精确匹配季节与暴雪草价，并显示现金缺口', () => {
    const state = createRun(31);
    state.season = 'winter';
    state.weather = 'blizzard';
    state.money = 900;
    const result = actionStatus(state, { kind: 'buy-hay', kg: 200 });
    expect(result.cost).toBe(960);
    expect(result.reason).toContain('60');
    state.money = 960;
    expect(actionStatus(state, { kind: 'buy-hay', kg: 200 }).reason).toBeNull();
  });

  it('行动耗尽和本局结束均有恢复方向', () => {
    const state = createRun(31);
    state.actionsLeft = 0;
    expect(actionStatus(state, { kind: 'graze', cellId: 'P1' }).reason).toContain('结束本周');
    state.ended = true;
    expect(actionStatus(state, { kind: 'graze', cellId: 'P1' }).reason).toContain('经营结算');
  });

  it('避免无病治疗和没有适龄母畜时配种', () => {
    const state = createRun(31);
    expect(actionStatus(state, { kind: 'vet' }).reason).toContain('没有');
    state.animals = state.animals.map((animal) => ({ ...animal, pregnant: true }));
    expect(actionStatus(state, { kind: 'breed' }).reason).toContain('未妊娠');
  });

  it('治疗费用只计算活着的患病牲畜', () => {
    const state = createRun(31);
    state.animals[0].health = 'sick';
    state.animals[1].health = 'sick';
    state.animals[1].alive = false;
    expect(actionStatus(state, { kind: 'vet' })).toEqual({ cost: 250, reason: null });
  });

  it('避免重复购买免疫和监测，项圈按剩余批量计价', () => {
    const state = createRun(31);
    state.tech = { collared: 47, vaccinated: true, scanned: true };
    state.animals = state.animals.map((animal, i) => ({ ...animal, collar: i < 47 }));
    expect(actionStatus(state, { kind: 'tech', tech: 'vaccine' }).reason).toContain('无需重复');
    expect(actionStatus(state, { kind: 'tech', tech: 'scan' }).reason).toContain('无需重复');
    expect(actionStatus(state, { kind: 'tech', tech: 'collar' })).toEqual({ cost: 540, reason: null });
    state.tech.collared = 50;
    state.animals = state.animals.map(animal => ({ ...animal, collar: true }));
    expect(actionStatus(state, { kind: 'tech', tech: 'collar' }).reason).toContain('没有');
  });

  it('空草场和已离栏牲畜无法执行无效操作', () => {
    const state = createRun(31);
    state.pasture[0].biomassKgPerHa = 0;
    expect(actionStatus(state, { kind: 'graze', cellId: 'P1' }).reason).toContain('休牧');
    expect(actionStatus(state, { kind: 'sell', animalIds: ['missing'] }).reason).toContain('不在存栏');
  });
});

describe('经营操作反馈与存档', () => {
  beforeEach(() => { gameState.newGame(31); vi.spyOn(saveSystem, 'save').mockReturnValue(true); });
  afterEach(() => vi.restoreAllMocks());

  it('成功操作反馈真实日志、保存状态，并原位更新面板', () => {
    const feedback = { toast: vi.fn() };
    const refresh = vi.fn();
    expect(actFromPanel({ kind: 'buy-hay', kg: 200 }, feedback, refresh)).toBe(true);
    expect(gameState.actionsLeft).toBe(2);
    expect(gameState.hayKg).toBe(2400);
    expect(feedback.toast).toHaveBeenCalledWith(gameState.log.at(-1)!.text, 'good');
    expect(saveSystem.save).toHaveBeenCalledWith(gameState.toData());
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('拒绝操作会说明原因，同时保留行动点和当前面板', () => {
    gameState.run.money = 0;
    const before = gameState.run;
    const feedback = { toast: vi.fn() };
    const refresh = vi.fn();
    expect(actFromPanel({ kind: 'buy-hay', kg: 200 }, feedback, refresh)).toBe(false);
    expect(gameState.run).toBe(before);
    expect(gameState.actionsLeft).toBe(3);
    expect(feedback.toast.mock.calls[0][0]).toContain('现金不足');
    expect(saveSystem.save).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('存档失败明确告知，不撤销已经完成的经营动作', () => {
    vi.mocked(saveSystem.save).mockReturnValue(false);
    const feedback = { toast: vi.fn() };
    const refresh = vi.fn();
    expect(actFromPanel({ kind: 'buy-hay', kg: 200 }, feedback, refresh)).toBe(true);
    expect(gameState.hayKg).toBe(2400);
    expect(feedback.toast.mock.calls.at(-1)![0]).toContain('未能保存');
    expect(refresh).toHaveBeenCalledOnce();
  });
});
