import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../src/core/GameState';

const mocks = vi.hoisted(() => ({ isBlocking: vi.fn(), toast: vi.fn(), openTutorial: vi.fn() }));
vi.mock('../src/ui/instance', () => ({ ui: mocks }));
vi.mock('../src/ui/tutorial', () => ({ openTutorialWeek: mocks.openTutorial }));

class Invitation {
  classes = new Set(['hidden']);
  classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
  start = new EventTarget();
  skip = new EventTarget();
  querySelector(selector: string): EventTarget | null {
    return selector === '#tutorial-invitation-start' ? this.start : selector === '#tutorial-invitation-skip' ? this.skip : null;
  }
}

let invitation: Invitation | null;
let store: Map<string, string>;
let state: GameState;
let entry: typeof import('../src/ui/tutorialEntry');
let prefs: typeof import('../src/ui/tutorialPreferences');
let cleanup: (() => void) | undefined;
let blocked: boolean;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  store = new Map();
  invitation = new Invitation();
  blocked = false;
  mocks.isBlocking.mockImplementation(() => blocked);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  });
  vi.stubGlobal('document', { getElementById: (id: string) => id === 'tutorial-invitation' ? invitation : null });
  state = (await import('../src/core/GameState')).gameState;
  state.newGame(92);
  entry = await import('../src/ui/tutorialEntry');
  prefs = await import('../src/ui/tutorialPreferences');
});

afterEach(() => { cleanup?.(); cleanup = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('非阻断教学邀请的生命周期', () => {
  it('只显示一次且不执行真实经营，跳过后重载仍不重复邀请', async () => {
    const original = state.toData();
    cleanup = entry.mountTutorialInvitation();
    expect(invitation!.classes.has('hidden')).toBe(false);
    expect(mocks.openTutorial).not.toHaveBeenCalled();
    expect(state.toData()).toEqual(original);
    expect([...store.keys()]).toEqual(['muyun-tutorial-ui-v1']);
    invitation!.skip.dispatchEvent(new Event('click'));
    expect(invitation!.classes.has('hidden')).toBe(true);
    cleanup();
    vi.resetModules();
    entry = await import('../src/ui/tutorialEntry');
    entry.mountTutorialInvitation();
    expect(invitation!.classes.has('hidden')).toBe(true);
    expect(mocks.openTutorial).not.toHaveBeenCalled();
  });

  it('主动进入才延迟打开教学周，不改全局状态或正式存档', async () => {
    const original = state.toData();
    cleanup = entry.mountTutorialInvitation();
    invitation!.start.dispatchEvent(new Event('click'));
    expect(invitation!.classes.has('hidden')).toBe(true);
    await vi.dynamicImportSettled();
    expect(mocks.openTutorial).toHaveBeenCalledOnce();
    expect(state.toData()).toEqual(original);
    expect([...store.keys()]).toEqual(['muyun-tutorial-ui-v1']);
  });

  it('卸载移除邀请监听，旧节点点击不能再开启教学', async () => {
    cleanup = entry.mountTutorialInvitation();
    cleanup();
    cleanup();
    invitation!.start.dispatchEvent(new Event('click'));
    invitation!.skip.dispatchEvent(new Event('click'));
    await vi.dynamicImportSettled();
    expect(mocks.openTutorial).not.toHaveBeenCalled();
    expect(invitation!.classes.has('hidden')).toBe(true);
  });

  it('挑战、结束局、现有弹窗及缺少容器均不显示，也不提前消耗邀请', () => {
    state.newGame(undefined, 'winter-challenge-v1');
    entry.mountTutorialInvitation();
    expect(prefs.tutorialPreferences().offered).toBe(false);
    state.newGame(93);
    const ended = state.toData();
    ended.run.ended = true;
    state.load(ended);
    entry.mountTutorialInvitation();
    expect(prefs.tutorialPreferences().offered).toBe(false);
    state.newGame(94);
    blocked = true;
    entry.mountTutorialInvitation();
    expect(prefs.tutorialPreferences().offered).toBe(false);
    blocked = false;
    const host = invitation;
    invitation = null;
    entry.mountTutorialInvitation();
    expect(prefs.tutorialPreferences().offered).toBe(false);
    invitation = host;
    cleanup = entry.mountTutorialInvitation();
    expect(invitation!.classes.has('hidden')).toBe(false);
    expect(prefs.tutorialPreferences().offered).toBe(true);
  });

  it('完成教学的玩家不再收到邀请，但仍能通过标题主动启动', async () => {
    prefs.completeTutorial();
    entry.mountTutorialInvitation();
    expect(invitation!.classes.has('hidden')).toBe(true);
    entry.launchTutorial();
    entry.launchTutorial();
    await vi.dynamicImportSettled();
    expect(mocks.openTutorial).toHaveBeenCalledOnce();
  });

  it('已有弹窗阻止启动，异步加载后也不覆盖新打开的面板', async () => {
    blocked = true;
    entry.launchTutorial();
    await vi.dynamicImportSettled();
    expect(mocks.openTutorial).not.toHaveBeenCalled();
    blocked = false;
    entry.launchTutorial();
    blocked = true;
    await vi.dynamicImportSettled();
    expect(mocks.openTutorial).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
