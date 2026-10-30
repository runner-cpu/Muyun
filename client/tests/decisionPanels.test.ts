import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callbacks: new Map<string, () => void>(),
  openModal: vi.fn(), closeModal: vi.fn(), toast: vi.fn(), overview: vi.fn(), returnTitle: vi.fn(),
}));
vi.mock('../src/ui/instance', () => ({ ui: {
  openModal: mocks.openModal, closeModal: mocks.closeModal, toast: mocks.toast, onReturnTitle: mocks.returnTitle,
} }));
vi.mock('../src/ui/panels/overview', () => ({ openOverviewPanel: mocks.overview }));

import { gameState } from '../src/core/GameState';
import { saveSystem } from '../src/systems/SaveSystem';
import { openResultPanel } from '../src/ui/panels/result';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbacks.clear();
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  mocks.openModal.mockImplementation(() => ({
    querySelector: (selector: string) => ({
      addEventListener: (_event: string, callback: () => void) => mocks.callbacks.set(selector, callback),
    }),
  }));
  gameState.newGame(27);
});
afterEach(() => vi.unstubAllGlobals());

function markEnded(): void {
  const data = gameState.toData();
  data.run.ended = true;
  data.run.ending = 'subsistence';
  gameState.load(data);
}

describe('结算面板的存档与历史边界', () => {
  it('重开挑战保留完整局存档和玩家设置，并回到真实新挑战', () => {
    const year = gameState.toData();
    year.run.money = 23456;
    saveSystem.save(year);
    gameState.newGame(undefined, 'winter-challenge-v1');
    gameState.setSettings({ music: 0.13, sfx: 0.77, muted: true });
    markEnded();
    saveSystem.save(gameState.toData());
    openResultPanel();
    mocks.callbacks.get('#result-again')!();
    expect(gameState.run.scenario).toBe('winter-challenge-v1');
    expect(gameState.run.seed).toBe(20261030);
    expect(gameState.week).toBe(10);
    expect(gameState.ended).toBe(false);
    expect(gameState.settings).toEqual({ music: 0.13, sfx: 0.77, muted: true });
    expect(saveSystem.load('year')?.run.money).toBe(23456);
    expect(saveSystem.load('winter-challenge-v1')?.run.ended).toBe(false);
    expect(mocks.overview).toHaveBeenCalledTimes(1);
  });

  it('完整局按原种子重开时保留挑战存档', () => {
    gameState.newGame(undefined, 'winter-challenge-v1');
    const challenge = gameState.toData();
    challenge.run.money = 5432;
    saveSystem.save(challenge);
    gameState.newGame(998877, 'year');
    markEnded();
    openResultPanel();
    mocks.callbacks.get('#result-again')!();
    expect(gameState.run.seed).toBe(998877);
    expect(gameState.run.scenario).toBe('year');
    expect(gameState.week).toBe(1);
    expect(saveSystem.load('winter-challenge-v1')?.run.money).toBe(5432);
  });

  it('完局前禁用对照与导出，历史日志不会插入未转义 HTML', () => {
    const data = gameState.toData();
    data.run.log.push({ week: 1, tone: 'info', text: '<img src=x onerror=alert(1)>' });
    gameState.load(data);
    openResultPanel();
    const body = mocks.openModal.mock.lastCall?.[0].body as string;
    expect(body).toMatch(/id="result-compare"\s+disabled/);
    expect(body).toMatch(/id="result-export"\s+disabled/);
    expect(body).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(body).not.toContain('<img');
  });
});
