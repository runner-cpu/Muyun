import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(), toast: vi.fn(), herd: vi.fn(), html: '', callbacks: new Map<string, () => void>(),
}));
vi.mock('../src/ui/instance', () => ({ ui: { openModal: mocks.openModal, toast: mocks.toast } }));
vi.mock('../src/ui/panels/herd', () => ({ openHerdPanel: mocks.herd }));

import { gameState } from '../src/core/GameState';
import { openAnimalDetail } from '../src/ui/panels/animalDetail';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbacks.clear();
  mocks.html = '';
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  mocks.openModal.mockImplementation(() => ({
    get innerHTML() { return mocks.html; },
    set innerHTML(value: string) { mocks.html = value; },
    querySelector: (selector: string) => mocks.html.includes(`id="${selector.slice(1)}"`) ? {
      addEventListener: (_event: string, callback: () => void) => mocks.callbacks.set(selector, callback),
    } : null,
  }));
  gameState.newGame(27);
});
afterEach(() => vi.unstubAllGlobals());

describe('real animal detail', () => {
  it('opens the requested persistent record and escapes the ear tag in body and heading', () => {
    const state = gameState.toData();
    const selected = state.run.animals[4];
    selected.tag = '<img src=x>';
    selected.weightKg = 317;
    selected.bcs = 2.1;
    selected.collar = true;
    gameState.load(state);
    openAnimalDetail(selected.id);
    expect(mocks.openModal.mock.lastCall?.[0].title).toContain('&lt;img src=x&gt;');
    expect(mocks.html).toContain('317 kg');
    expect(mocks.html).toContain('2.1');
    expect(mocks.html).toContain('&lt;img src=x&gt;');
    expect(mocks.html).toContain('尚无完整测量区间');
    expect(mocks.html).not.toContain('<img');
    expect(mocks.html).not.toContain('id="animal-vet"');
    mocks.callbacks.get('#animal-herd')!();
    expect(mocks.herd).toHaveBeenCalledOnce();
  });

  it('treats the actual sick herd through the shared action, then refreshes the selected record', () => {
    const state = gameState.toData();
    state.run.animals[0].health = 'sick';
    state.run.animals[1].health = 'sick';
    const id = state.run.animals[0].id;
    gameState.load(state);
    const money = gameState.money;
    const points = gameState.actionsLeft;
    openAnimalDetail(id);
    expect(mocks.html).toContain('治疗全群 2 头患病牲畜');
    mocks.callbacks.get('#animal-vet')!();
    expect(gameState.animals.filter(item => item.alive && item.health === 'sick')).toHaveLength(0);
    expect(gameState.money).toBe(money - 300);
    expect(gameState.actionsLeft).toBe(points - 1);
    expect(mocks.html).not.toContain('id="animal-vet"');
    expect(mocks.html).toContain('健康');
  });

  it('rejects absent or departed IDs instead of showing another animal', () => {
    const state = gameState.toData();
    const departed = state.run.animals[0];
    departed.alive = false;
    gameState.load(state);
    openAnimalDetail(departed.id);
    openAnimalDetail('unknown');
    expect(mocks.openModal).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledTimes(2);
  });
});
