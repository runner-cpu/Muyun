import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ui: {
    showTitle: vi.fn(), hideTitle: vi.fn(), openModal: vi.fn(), closeModal: vi.fn(), toast: vi.fn(),
    onNewGame: null as (() => void) | null,
    onContinue: null as (() => void) | null,
  },
  audio: { setSettings: vi.fn(), unlock: vi.fn() },
}));

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../src/ui/instance', () => ({ ui: mocks.ui }));
vi.mock('../src/systems/AudioManager', () => ({ audio: mocks.audio }));

import { gameState } from '../src/core/GameState';
import { createDefaultState } from '../src/core/defaultState';
import { TitleScene } from '../src/scenes/TitleScene';
import { saveSystem } from '../src/systems/SaveSystem';
import type { UIManager } from '../src/ui/UIManager';
import { openSettingsPanel } from '../src/ui/settings';

class Control extends EventTarget {
  classList = { add: vi.fn(), remove: vi.fn() };
  value = '';
  checked = false;
  textContent = '';
}

let playing = false;
let controls: Record<string, Control>;

beforeEach(() => {
  vi.clearAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  playing = false;
  vi.stubGlobal('document', {
    documentElement: { dataset: {} },
    getElementById: () => ({ dataset: { playing: String(playing) } }),
  });
  controls = Object.fromEntries([
    '#set-music', '#set-sfx', '#set-muted', '#set-theme', '#out-music', '#out-sfx',
    '#set-fullscreen', '#set-reset',
  ].map((selector) => [selector, new Control()]));
  mocks.ui.openModal.mockImplementation(({ body }: { body: string }) => {
    for (const name of ['music', 'sfx']) {
      controls[`#set-${name}`].value = body.match(new RegExp(`id="set-${name}"[^>]*value="([^"]*)"`))![1];
    }
    controls['#set-muted'].checked = body.includes('id="set-muted" type="checkbox" checked');
    return { querySelector: (selector: string) => controls[selector] };
  });
  gameState.newGame(11);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mountTitle(): TitleScene {
  const scene = new TitleScene();
  const backdrop = scene as unknown as { drawBackdrop(): void; createMotes(): void };
  vi.spyOn(backdrop, 'drawBackdrop').mockImplementation(() => undefined);
  vi.spyOn(backdrop, 'createMotes').mockImplementation(() => undefined);
  const camera = { setZoom: vi.fn().mockReturnThis(), centerOn: vi.fn().mockReturnThis() };
  Object.assign(scene, { scene: { start: vi.fn() }, cameras: { main: camera } });
  scene.create();
  return scene;
}

function existingSave() {
  const saved = createDefaultState(999);
  saved.run.week = 7;
  saved.run.season = 'autumn';
  saved.run.money = 4321;
  saved.run.actionsLeft = 1;
  saved.run.flags['pending-event:7:neighbour'] = true;
  saved.player = { x: 111, y: 222 };
  saved.settings = { music: 0.17, sfx: 0.63, muted: true };
  expect(saveSystem.save(saved)).toBe(true);
  return saved;
}

function openSettings(): void {
  openSettingsPanel(mocks.ui as unknown as UIManager);
}

describe('sound settings and saved progress', () => {
  it('requires explicit confirmation to replace an existing year and preserves it on cancel', () => {
    existingSave();
    const saved = saveSystem.load('year');
    const scene = mountTitle();
    const cancel = new Control();
    const confirm = new Control();
    mocks.ui.openModal.mockImplementation(() => ({ querySelector: (selector: string) => selector === '#new-cancel' ? cancel : confirm }));
    mocks.ui.onNewGame!();
    expect(saveSystem.load('year')).toEqual(saved);
    cancel.dispatchEvent(new Event('click'));
    expect(scene.scene.start).not.toHaveBeenCalled();
    expect(saveSystem.load('year')).toEqual(saved);
    mocks.ui.onNewGame!();
    confirm.dispatchEvent(new Event('click'));
    expect(saveSystem.load('year')?.run.week).toBe(1);
    expect(scene.scene.start).toHaveBeenCalledWith('RanchScene');
  });

  it('keeps damaged bytes on title and shows an unreadable-save message', () => {
    localStorage.setItem('muyun-save', '{broken');
    const status = new Control();
    vi.stubGlobal('document', { getElementById: () => status });
    mountTitle();
    expect(status.textContent).toContain('原始数据仍保留');
    expect(mocks.ui.showTitle).toHaveBeenCalledWith(false);
    expect(localStorage.getItem('muyun-save')).toBe('{broken');
  });

  it('reports failure to save a newly started game', () => {
    mountTitle();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    mocks.ui.onNewGame!();
    expect(mocks.ui.toast).toHaveBeenCalledWith(expect.stringContaining('未能保存'), 'bad', 4500);
    expect(gameState.week).toBe(1);
  });

  it('restores saved sound on the title screen before continuing a run', () => {
    const saved = existingSave();
    mountTitle();
    openSettings();
    expect(gameState.week).toBe(1);
    expect(gameState.settings).toEqual(saved.settings);
    expect(mocks.audio.setSettings).toHaveBeenCalledWith(saved.settings);
    expect(controls['#set-music'].value).toBe('17');
    expect(controls['#set-sfx'].value).toBe('63');
    expect(controls['#set-muted'].checked).toBe(true);
    expect(mocks.ui.showTitle).toHaveBeenCalledWith(true);
  });

  it('preserves the saved run and player when changing title sound, then continues that run', () => {
    const saved = existingSave();
    mountTitle();
    openSettings();
    controls['#set-music'].value = '61';
    controls['#set-music'].dispatchEvent(new Event('input'));
    controls['#set-muted'].checked = false;
    controls['#set-muted'].dispatchEvent(new Event('change'));
    const updated = saveSystem.load()!;
    expect(updated.run).toEqual(saved.run);
    expect(updated.player).toEqual(saved.player);
    expect(updated.settings).toEqual({ music: 0.61, sfx: 0.63, muted: false });
    mocks.ui.onContinue!();
    expect(gameState.run).toEqual(saved.run);
    expect(gameState.getSpawn()).toEqual(saved.player);
    expect(gameState.settings).toEqual(updated.settings);
  });

  it('does not create a save for title sound alone, but persists the chosen new game immediately', () => {
    mountTitle();
    openSettings();
    controls['#set-music'].value = '9';
    controls['#set-music'].dispatchEvent(new Event('input'));
    controls['#set-muted'].checked = true;
    controls['#set-muted'].dispatchEvent(new Event('change'));
    expect(saveSystem.exists()).toBe(false);
    expect(mocks.ui.showTitle).toHaveBeenCalledWith(false);
    mocks.ui.onNewGame!();
    expect(gameState.settings).toEqual({ music: 0.09, sfx: 0.45, muted: true });
    expect(saveSystem.load()?.run).toEqual(gameState.run);
    expect(saveSystem.load()?.settings).toEqual(gameState.settings);
  });

  it('saves current unsaved progress and player position for in-game sound changes', () => {
    gameState.load(existingSave());
    gameState.act({ kind: 'buy-hay', kg: 200 });
    gameState.setPlayer(333, 444);
    const current = gameState.toData();
    playing = true;
    openSettings();
    controls['#set-sfx'].value = '26';
    controls['#set-sfx'].dispatchEvent(new Event('input'));
    const updated = saveSystem.load()!;
    expect(updated.run).toEqual(current.run);
    expect(updated.player).toEqual(current.player);
    expect(updated.settings).toEqual({ ...current.settings, sfx: 0.26 });
  });

  it.each(['year', 'winter-challenge-v1'] as const)('clears only %s and prevents exit events from rebuilding it', scenario => {
    existingSave();
    const year = saveSystem.load('year')!;
    gameState.newGame(undefined, 'winter-challenge-v1');
    saveSystem.save(gameState.toData());
    const winter = saveSystem.load('winter-challenge-v1')!;
    gameState.load(scenario === 'year' ? year : winter);
    saveSystem.setMode(scenario);
    playing = true;
    const reload = vi.fn(() => { saveSystem.saveOnExit(gameState.toData()); });
    vi.stubGlobal('window', { confirm: vi.fn(() => true), location: { reload } });

    openSettings();
    controls['#set-reset'].dispatchEvent(new Event('click'));

    expect(reload).toHaveBeenCalledOnce();
    expect(saveSystem.load(scenario)).toBeNull();
    expect(saveSystem.load(scenario === 'year' ? 'winter-challenge-v1' : 'year'))
      .toEqual(scenario === 'year' ? winter : year);
    // A later pagehide must remain suppressed as well as the first beforeunload.
    expect(saveSystem.saveOnExit(gameState.toData())).toBe(false);
    expect(saveSystem.load(scenario)).toBeNull();
  });

  it('keeps progress when clearing is cancelled or storage removal fails', () => {
    existingSave();
    const saved = saveSystem.load('year')!;
    gameState.load(saved);
    playing = true;
    const confirm = vi.fn(() => false);
    const reload = vi.fn();
    vi.stubGlobal('window', { confirm, location: { reload } });
    openSettings();
    controls['#set-reset'].dispatchEvent(new Event('click'));
    expect(reload).not.toHaveBeenCalled();
    expect(saveSystem.load('year')).toEqual(saved);

    confirm.mockReturnValue(true);
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new Error('storage denied'); });
    controls['#set-reset'].dispatchEvent(new Event('click'));
    expect(reload).not.toHaveBeenCalled();
    expect(saveSystem.load('year')).toEqual(saved);
    expect(mocks.ui.toast).toHaveBeenCalledWith(expect.stringContaining('未能清除'), 'bad');
  });
});
