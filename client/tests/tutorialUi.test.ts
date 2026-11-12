import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../src/core/GameState';

const mocks = vi.hoisted(() => ({
  ui: {
    openModal: vi.fn(), closeModal: vi.fn(), showTitle: vi.fn(), hideTitle: vi.fn(), toast: vi.fn(),
    isBlocking: vi.fn(), onNewGame: null as (() => void) | null,
  },
  audio: { setSettings: vi.fn(), unlock: vi.fn() },
}));
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../src/ui/instance', () => ({ ui: mocks.ui }));
vi.mock('../src/systems/AudioManager', () => ({ audio: mocks.audio }));

class Control extends EventTarget {
  disabled = false;
  value = '';
  textContent = '';
  focus = vi.fn();
}

class Content {
  private markup = '';
  controls = new Map<string, Control>();
  get innerHTML(): string { return this.markup; }
  set innerHTML(value: string) {
    this.markup = value;
    this.controls.clear();
    for (const match of value.matchAll(/<(button|select|span)[^>]*id="([^"]+)"([^>]*)>/g)) {
      const node = new Control();
      node.disabled = /\bdisabled\b/.test(match[3]);
      if (match[1] === 'select') {
        const remaining = value.slice((match.index ?? 0) + match[0].length);
        node.value = remaining.match(/<option value="([^"]+)"/)?.[1] ?? '';
      }
      this.controls.set(`#${match[2]}`, node);
    }
  }
  querySelector(selector: string): Control | null { return this.controls.get(selector) ?? null; }
}

type Options = { title: string; body: string; onClose?: () => void };
let current: Options | null;
let content: Content;
let classes: Set<string>;
let title: Control;
let state: GameState;
let openTutorial: () => void;
let saves: typeof import('../src/systems/SaveSystem').saveSystem;
let store: Map<string, string>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  classes = new Set();
  title = new Control();
  store = new Map();
  current = null;
  mocks.ui.onNewGame = null;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: (key: string) => store.delete(key),
  });
  vi.stubGlobal('document', {
    getElementById: (id: string) => id === 'modal-card'
      ? { classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } }
      : id === 'modal-title' ? title : new Control(),
  });
  mocks.ui.closeModal.mockImplementation(() => {
    const previous = current;
    current = null;
    previous?.onClose?.();
  });
  mocks.ui.isBlocking.mockImplementation(() => Boolean(current));
  mocks.ui.openModal.mockImplementation((options: Options) => {
    if (current) mocks.ui.closeModal();
    current = options;
    title.textContent = options.title;
    content = new Content();
    content.innerHTML = options.body;
    return {
      querySelector: (selector: string) => selector === '#tutorial-content'
        ? content : content.querySelector(selector),
    };
  });
  state = (await import('../src/core/GameState')).gameState;
  state.newGame(91);
  saves = (await import('../src/systems/SaveSystem')).saveSystem;
  openTutorial = (await import('../src/ui/tutorial')).openTutorialWeek;
});

afterEach(() => { mocks.ui.closeModal(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function click(selector: string): void {
  const control = content.querySelector(selector);
  expect(control, selector).not.toBeNull();
  expect(control!.disabled, `${selector} should be enabled`).toBe(false);
  control!.dispatchEvent(new Event('click'));
}

describe('独立教学周的实际界面流程', () => {
  it('显示一致的需草数，放牧与按缺口购草后复盘，并可重试且不触碰经营状态', () => {
    const original = state.toData();
    openTutorial();
    expect(content.innerHTML).toContain('<dt>本周需草</dt><dd>462 kg</dd>');
    expect(content.innerHTML).toContain('<dt>饲草缺口</dt><dd>462 kg</dd>');
    click('#tutorial-graze');
    expect(content.innerHTML).toContain('<dt>实际可用草</dt><dd>300 kg</dd>');
    expect(content.querySelector('#tutorial-quantity')!.value).toBe('162');
    click('#tutorial-buy');
    expect(content.innerHTML).toContain('<dt>饲草缺口</dt><dd>0 kg</dd>');
    click('#tutorial-settle');
    expect(title.textContent).toBe('教学复盘');
    expect(content.innerHTML).toContain('已覆盖本周需草 462 kg');
    expect(content.querySelector('#tutorial-enter-year')!.focus).toHaveBeenCalled();
    expect([...store.keys()]).toEqual(['muyun-tutorial-ui-v1']);
    expect(state.toData()).toEqual(original);
    click('#tutorial-retry');
    expect(title.textContent).toBe('教学周 · 先喂饱牦牛');
    expect(content.innerHTML).toContain('<dt>实际可用草</dt><dd>0 kg</dd>');
    expect(state.toData()).toEqual(original);
    mocks.ui.closeModal();
    expect(classes.has('tutorial-modal')).toBe(false);
  });

  it('固定购草档位使用同一个购草按钮，并按原费用反馈', () => {
    openTutorial();
    const quantity = content.querySelector('#tutorial-quantity')!;
    expect(content.querySelector('#tutorial-buy')!.disabled).toBe(true);
    quantity.value = '200';
    quantity.dispatchEvent(new Event('change'));
    expect(content.querySelector('#tutorial-buy')!.disabled).toBe(false);
    expect(content.querySelector('#tutorial-buy')!.textContent).toContain('352');
    click('#tutorial-buy');
    expect(content.innerHTML).toContain('<dt>实际可用草</dt><dd>200 kg</dd>');
    click('#tutorial-graze');
    click('#tutorial-settle');
    expect(content.innerHTML).toContain('购草补入 200 kg');
    expect(content.innerHTML).toContain('实际可用 500 kg');
  });

  it('未补足也能复盘，进入正式经营先经过既有覆盖确认，取消保留两种存档', async () => {
    saves.setMode('year');
    expect(saves.save(state.toData())).toBe(true);
    state.newGame(undefined, 'winter-challenge-v1');
    saves.setMode('winter-challenge-v1');
    expect(saves.save(state.toData())).toBe(true);
    const year = store.get('muyun-save');
    const winter = store.get('muyun-save-winter');
    expect(year).toBeTruthy();
    expect(winter).toBeTruthy();
    const { TitleScene } = await import('../src/scenes/TitleScene');
    const scene = new TitleScene();
    const surface = scene as unknown as { drawBackdrop(): void; createMotes(): void };
    vi.spyOn(surface, 'drawBackdrop').mockImplementation(() => undefined);
    vi.spyOn(surface, 'createMotes').mockImplementation(() => undefined);
    Object.assign(scene, {
      cameras: { main: { setZoom: vi.fn().mockReturnThis(), centerOn: vi.fn().mockReturnThis() } },
      scene: { start: vi.fn() },
    });
    scene.create();
    openTutorial();
    click('#tutorial-settle');
    expect(content.innerHTML).toContain('仍缺 462 kg');
    click('#tutorial-enter-year');
    expect(current?.title).toBe('重新开始完整经营？');
    expect(store.get('muyun-save')).toBe(year);
    expect(store.get('muyun-save-winter')).toBe(winter);
    expect(scene.scene.start).not.toHaveBeenCalled();
    click('#new-cancel');
    expect(store.get('muyun-save')).toBe(year);
    expect(store.get('muyun-save-winter')).toBe(winter);
    expect(scene.scene.start).not.toHaveBeenCalled();
  });

  it('直接关闭练习不算完成，也不创建真实存档', async () => {
    openTutorial();
    click('#tutorial-graze');
    mocks.ui.closeModal();
    expect(classes.has('tutorial-modal')).toBe(false);
    expect(store.size).toBe(0);
    const { tutorialPreferences } = await import('../src/ui/tutorialPreferences');
    expect(tutorialPreferences()).toEqual({offered:false,completed:false});
  });
});
