import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pasture: vi.fn(), market: vi.fn(), herd: vi.fn(), openModal: vi.fn(),
  callbacks: new Map<string, () => void>(),
}));
vi.mock('../src/ui/panels/pasture', () => ({ openPasturePanel: mocks.pasture }));
vi.mock('../src/ui/panels/market', () => ({ openMarketPanel: mocks.market }));
vi.mock('../src/ui/panels/herd', () => ({ openHerdPanel: mocks.herd }));

import { gameState } from '../src/core/GameState';
import type { UIManager } from '../src/ui/UIManager';
import { openFieldNotes } from '../src/ui/panels/fieldnotes';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbacks.clear();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  gameState.newGame(81);
  mocks.openModal.mockImplementation((options: { body: string }) => ({
    querySelector: (selector: string) => options.body.includes(`id="${selector.slice(1)}"`) ? {
      addEventListener: (_event: string, callback: () => void) => mocks.callbacks.set(selector, callback),
    } : null,
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('plateau field notes panel', () => {
  const ui = { openModal: mocks.openModal } as unknown as UIManager;

  it('opens all current observation entries with operational navigation', () => {
    openFieldNotes(ui);
    const options = mocks.openModal.mock.lastCall?.[0];
    expect(options.title).toBe('高原手记');
    expect(options.body).toContain('冬草储备与季节窗口');
    expect(options.body).toContain('连续休牧');
    expect(options.body).toContain('牦牛与藏羊');
    expect(options.body).toContain('不能用于真实气象或生产决策');
    mocks.callbacks.get('#fieldnotes-open-pasture')!();
    mocks.callbacks.get('#fieldnotes-open-market')!();
    mocks.callbacks.get('#fieldnotes-open-herd')!();
    expect(mocks.pasture).toHaveBeenCalledOnce();
    expect(mocks.market).toHaveBeenCalledOnce();
    expect(mocks.herd).toHaveBeenCalledOnce();
  });

  it('does not spend actions, money, hay or advance time when read', () => {
    const before = JSON.stringify(gameState.run);
    openFieldNotes(ui);
    expect(JSON.stringify(gameState.run)).toBe(before);
  });

  it('opens explanations after a finished run without offering a new simulation action', () => {
    const data = gameState.toData();
    data.run.ended = true;
    data.run.ending = 'subsistence';
    gameState.load(data);
    openFieldNotes(ui);
    expect(mocks.openModal).toHaveBeenCalledOnce();
    expect(mocks.callbacks.size).toBe(3);
    expect(gameState.ended).toBe(true);
  });
});
