import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../src/core/GameState';

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(), closeModal: vi.fn(), isBlocking: vi.fn(), overview: vi.fn(),
}));
vi.mock('../src/ui/instance', () => ({ ui: mocks }));
vi.mock('../src/ui/panels/overview', () => ({ openOverviewPanel: mocks.overview }));

type Options = { body: string; subtitle?: string; onClose?: () => void };
let active: Options | null;
let playing: boolean;
let hudHidden: boolean;
let blocked: boolean;
let controls: Map<string, EventTarget>;
let classes: Set<string>;
let storage: Map<string, string>;
let state: GameState;
let guide: typeof import('../src/ui/onboarding');

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  active = null;
  playing = true;
  hudHidden = false;
  blocked = false;
  classes = new Set();
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  });
  vi.stubGlobal('document', {
    getElementById: (id: string) => id === 'app' ? { dataset: { playing: String(playing) } }
      : id === 'hud' ? { classList: { contains: () => hudHidden } }
      : id === 'modal-card' ? { classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } }
      : null,
  });
  mocks.isBlocking.mockImplementation(() => blocked);
  mocks.closeModal.mockImplementation(() => {
    const previous = active;
    active = null;
    blocked = false;
    previous?.onClose?.();
  });
  mocks.openModal.mockImplementation((options: Options) => {
    if (active) mocks.closeModal();
    active = options;
    blocked = true;
    controls = new Map(['#onboarding-skip', '#onboarding-back', '#onboarding-next'].map(id => [id, new EventTarget()]));
    return { querySelector: (selector: string) => controls.get(selector) ?? null };
  });
  state = (await import('../src/core/GameState')).gameState;
  state.newGame(37);
  guide = await import('../src/ui/onboarding');
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const click = (selector: string): void => { controls.get(selector)!.dispatchEvent(new Event('click')); };

describe('简易新手引导', () => {
  it('只在可操作牧场首次展示，且不更改经营数据', () => {
    const before = state.toData();
    guide.maybeShowOnboarding();
    expect(mocks.openModal).toHaveBeenCalledOnce();
    expect(active?.subtitle).toContain('1 / 3');
    expect(active?.body).toContain('收起或展开');
    expect(classes.has('onboarding-modal')).toBe(true);
    expect(state.toData()).toEqual(before);
    guide.maybeShowOnboarding();
    expect(mocks.openModal).toHaveBeenCalledOnce();
  });

  it('不覆盖其他弹窗，也不在标题页或隐藏HUD上展示', () => {
    blocked = true;
    guide.maybeShowOnboarding();
    blocked = false;
    playing = false;
    guide.maybeShowOnboarding();
    playing = true;
    hudHidden = true;
    guide.maybeShowOnboarding();
    expect(mocks.openModal).not.toHaveBeenCalled();
    hudHidden = false;
    guide.maybeShowOnboarding();
    expect(mocks.openModal).toHaveBeenCalledOnce();
  });

  it('未决事件和已结束局优先，不消耗尚未显示的引导', () => {
    state.setFlag('pending-event:1:drought');
    guide.maybeShowOnboarding();
    expect(mocks.openModal).not.toHaveBeenCalled();
    const data = state.toData();
    data.run.flags = {};
    data.run.ended = true;
    state.load(data);
    guide.maybeShowOnboarding();
    expect(mocks.openModal).not.toHaveBeenCalled();
    state.newGame(37);
    guide.maybeShowOnboarding();
    expect(mocks.openModal).toHaveBeenCalledOnce();
  });

  it('可以前后阅读三步，最后打开真实概览而不替玩家行动或结算', () => {
    const before = state.toData();
    guide.openOnboarding();
    click('#onboarding-next');
    expect(active?.subtitle).toContain('2 / 3');
    click('#onboarding-back');
    expect(active?.subtitle).toContain('1 / 3');
    click('#onboarding-next');
    click('#onboarding-next');
    expect(active?.subtitle).toContain('3 / 3');
    expect(active?.body).toContain('打开本周概览');
    click('#onboarding-next');
    expect(mocks.overview).toHaveBeenCalledOnce();
    expect(classes.has('onboarding-modal')).toBe(false);
    expect(state.toData()).toEqual(before);
  });

  it('跳过后不再自动出现，但可以从帮助主动重看', async () => {
    guide.maybeShowOnboarding();
    click('#onboarding-skip');
    expect(active).toBeNull();
    expect(classes.has('onboarding-modal')).toBe(false);
    guide.maybeShowOnboarding();
    expect(mocks.openModal).toHaveBeenCalledOnce();
    // A new module instance represents a reload: the persisted dismissal still wins.
    vi.resetModules();
    guide = await import('../src/ui/onboarding');
    guide.maybeShowOnboarding();
    expect(mocks.openModal).toHaveBeenCalledOnce();
    guide.openOnboarding();
    expect(mocks.openModal).toHaveBeenCalledTimes(2);
    expect(active?.subtitle).toContain('1 / 3');
  });

  it('关闭按钮或Esc经现有modal生命周期关闭后也不重复，窄型样式随之清理', () => {
    guide.maybeShowOnboarding();
    mocks.closeModal();
    expect(classes.has('onboarding-modal')).toBe(false);
    guide.maybeShowOnboarding();
    expect(mocks.openModal).toHaveBeenCalledOnce();
  });

  it('存储不可用时仍能跳过并在当前会话记住，不影响手动重看', () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('denied'); });
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('denied'); });
    expect(() => guide.maybeShowOnboarding()).not.toThrow();
    click('#onboarding-skip');
    guide.maybeShowOnboarding();
    expect(mocks.openModal).toHaveBeenCalledOnce();
    guide.openOnboarding();
    expect(mocks.openModal).toHaveBeenCalledTimes(2);
  });
});
