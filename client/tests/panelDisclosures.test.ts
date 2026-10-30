import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callbacks: new Map<string, () => void>(),
  expanded: new Set<string>(),
  openModal: vi.fn(), toast: vi.fn(), save: vi.fn(() => true),
}));
vi.mock('../src/ui/instance', () => ({ ui: { openModal: mocks.openModal, toast: mocks.toast } }));
vi.mock('../src/systems/SaveSystem', () => ({ saveSystem: { save: mocks.save } }));
vi.mock('../src/ui/panels/strategy', () => ({ openStrategyPanel: vi.fn() }));

import { gameState } from '../src/core/GameState';
import { openTechPanel } from '../src/ui/panels/tech';

let markup = '';
const root = {
  get innerHTML(): string { return markup; },
  set innerHTML(value: string) {
    markup = value;
    mocks.expanded.clear();
    for (const match of value.matchAll(/data-tech-detail="([^"]+)" open/g)) mocks.expanded.add(match[1]);
  },
  querySelectorAll: () => Array.from(mocks.expanded, detail => ({ dataset: { techDetail: detail } })),
  querySelector: (selector: string) => ({
    addEventListener: (_event: string, callback: () => void) => mocks.callbacks.set(selector, callback),
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbacks.clear();
  mocks.expanded.clear();
  markup = '';
  mocks.openModal.mockReturnValue(root);
  gameState.newGame(20261030);
});

describe('科技展开栏的操作连续性', () => {
  it('初次收纳明细，佩戴项圈后仍保留玩家展开的记录栏', () => {
    openTechPanel();
    expect(mocks.expanded.size).toBe(0);
    mocks.expanded.add('collar');
    const before = gameState.run;
    mocks.callbacks.get('#tech-collar')!();
    expect(gameState.actionsLeft).toBe(before.actionsLeft - 1);
    expect(gameState.money).toBe(before.money - 1800);
    expect(gameState.run.animals.filter(animal => animal.alive && animal.collar)).toHaveLength(10);
    expect(mocks.expanded).toEqual(new Set(['collar']));
    expect(markup).toContain('首次记录');
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it('收起明细不会阻止实际开通监测，完成后仍保持收起', () => {
    openTechPanel();
    const before = gameState.run;
    mocks.callbacks.get('#tech-scan')!();
    expect(gameState.run.tech.scanned).toBe(true);
    expect(gameState.money).toBe(before.money - 800);
    expect(gameState.actionsLeft).toBe(before.actionsLeft - 1);
    expect(mocks.expanded.size).toBe(0);
    expect(markup).toContain('id="tech-strategy"');
    expect(mocks.save).toHaveBeenCalledOnce();
  });
});
