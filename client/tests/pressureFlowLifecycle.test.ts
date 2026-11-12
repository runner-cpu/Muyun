import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ openModal: vi.fn(), closeModal: vi.fn() }));
vi.mock('../src/ui/instance', () => ({ ui: mocks }));
vi.mock('../src/ui/panels/strategy', () => ({ openStrategyPanel: vi.fn() }));

import { gameState } from '../src/core/GameState';
import { mountPressureFlow } from '../src/ui/pressureFlow';
import { openOverviewPanel } from '../src/ui/panels/overview';

class PressureHost extends EventTarget {
  innerHTML = '';
  focusedWeek: string | null = null;
  restoredWeek: string | null = null;
  querySelector(selector: string) {
    if (selector === '[data-pressure-week]:focus' && this.focusedWeek) {
      return { dataset: { pressureWeek: this.focusedWeek } };
    }
    const match = selector.match(/^\[data-pressure-week="(\d+)"\]$/);
    return match ? { focus: () => { this.restoredWeek = match[1]; } } : null;
  }
  contains() { return true; }
  clickWeek(week: number): void {
    const button = { dataset: { pressureWeek: String(week) } };
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: { closest: () => button } });
    this.dispatchEvent(event);
  }
}

type ModalOptions = { title: string; body: string; onClose?: () => void };
let active: ModalOptions | null;
let host: PressureHost | null;
let controls: Map<string, EventTarget>;
let unmount: (() => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  active = null;
  host = null;
  controls = new Map();
  gameState.newGame(21);
  mocks.closeModal.mockImplementation(() => {
    const previous = active;
    active = null;
    previous?.onClose?.();
  });
  mocks.openModal.mockImplementation((options: ModalOptions) => {
    if (active) mocks.closeModal();
    active = options;
    host = options.body.includes('id="overview-pressure-flow"') ? new PressureHost() : null;
    controls = new Map(Array.from(options.body.matchAll(/id="([^"]+)"/g), match => [`#${match[1]}`, new EventTarget()]));
    return { querySelector: (selector: string) => selector === '#overview-pressure-flow' ? host : controls.get(selector) ?? null };
  });
});

afterEach(() => { unmount?.(); unmount = undefined; mocks.closeModal(); });

describe('压力流向图的状态与面板生命周期', () => {
  it('挂载即显示，真实购草动作经状态通知缩小缺口，周结算后使用新周次', () => {
    const data = gameState.toData();
    data.run.animals = [{ ...data.run.animals[0], species: 'yak', weightKg: 200, alive: true }];
    data.run.hayKg = 0;
    gameState.load(data);
    const target = new PressureHost();
    unmount = mountPressureFlow(target as unknown as HTMLElement, () => undefined);
    const before = target.innerHTML;
    expect(before).toContain('data-pressure-week="1"');
    expect(before).toContain('库存可供 0 kg / 需草 39 kg · 缺 39 kg');
    expect(before).toContain('data-pressure-status="缺口"');
    gameState.act({ kind: 'buy-hay', kg: 500 });
    expect(target.innerHTML).not.toBe(before);
    expect(target.innerHTML).toContain('data-pressure-week="1"');
    expect(target.innerHTML).toContain('库存可供 39 kg / 需草 39 kg');
    expect(target.innerHTML).not.toContain('data-pressure-status="缺口"');
    gameState.endWeek();
    expect(target.innerHTML).toContain('data-pressure-week="2"');
    expect(target.innerHTML).not.toContain('data-pressure-week="1"');
  });

  it('卸载释放状态订阅和点击处理，多次清理也不会再写旧节点', () => {
    const target = new PressureHost();
    let openedWeek: number | null = null;
    unmount = mountPressureFlow(target as unknown as HTMLElement, week => { openedWeek = week; });
    target.clickWeek(2);
    expect(openedWeek).toBe(2);
    openedWeek = null;
    const before = target.innerHTML;
    unmount();
    unmount();
    target.clickWeek(3);
    gameState.act({ kind: 'buy-hay', kg: 500 });
    expect(openedWeek).toBeNull();
    expect(target.innerHTML).toBe(before);
  });

  it('状态刷新保留当前周行的键盘焦点，通知不改变内容时不重建节点', () => {
    const target = new PressureHost();
    unmount = mountPressureFlow(target as unknown as HTMLElement, () => undefined);
    target.focusedWeek = '2';
    gameState.setSettings({ muted: !gameState.settings.muted });
    expect(target.restoredWeek).toBeNull();
    gameState.act({ kind: 'buy-hay', kg: 200 });
    expect(target.restoredWeek).toBe('2');
  });

  it('概览自动挂载，任一行打开原储备账，返回时挂载最新状态且不保留旧订阅', () => {
    openOverviewPanel();
    const firstHost = host!;
    expect(active?.title).toBe('本周概览');
    expect(firstHost.innerHTML).toContain('三周压力');
    expect(active?.body.indexOf('overview-pressure-flow')).toBeGreaterThan(active?.body.indexOf('overview-risk') ?? 0);
    firstHost.clickWeek(2);
    expect(active?.title).toBe('三周储备账');
    expect(active?.body).toContain('假设逐周补足整公斤干草');
    const staleMarkup = firstHost.innerHTML;
    gameState.act({ kind: 'buy-hay', kg: 200 });
    expect(firstHost.innerHTML).toBe(staleMarkup);

    controls.get('#reserve-back')!.dispatchEvent(new Event('click'));
    expect(active?.title).toBe('本周概览');
    const secondHost = host!;
    expect(secondHost).not.toBe(firstHost);
    expect(secondHost.innerHTML).not.toBe(staleMarkup);
    const latest = secondHost.innerHTML;
    gameState.act({ kind: 'buy-hay', kg: 200 });
    expect(secondHost.innerHTML).not.toBe(latest);
    expect(firstHost.innerHTML).toBe(staleMarkup);

    mocks.closeModal();
    const closedMarkup = secondHost.innerHTML;
    gameState.newGame(22);
    expect(secondHost.innerHTML).toBe(closedMarkup);
  });
});
