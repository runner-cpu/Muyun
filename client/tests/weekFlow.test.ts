import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callbacks: new Map<string, () => void>(),
  closeModal: vi.fn(),
  save: vi.fn(),
  result: vi.fn(),
  event: vi.fn(),
  openModal: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../src/ui/instance', () => ({ ui: {
  openModal: mocks.openModal,
  closeModal: mocks.closeModal,
  toast: mocks.toast,
} }));
vi.mock('../src/systems/SaveSystem', () => ({ saveSystem: { save: mocks.save } }));
vi.mock('../src/ui/panels/event', () => ({ openEventPanel: mocks.event }));
vi.mock('../src/ui/panels/result', () => ({ openResultPanel: mocks.result }));

import { gameState } from '../src/core/GameState';
import { endWeekFlow, resumePendingWeek } from '../src/systems/WeekFlow';
import { pendingEventFlag } from '../src/ui/ranchView';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbacks.clear();
  mocks.save.mockReturnValue(true);
  mocks.openModal.mockImplementation(() => ({
    querySelector: (selector: string) => ({
      addEventListener: (_event: string, callback: () => void) => mocks.callbacks.set(selector, callback),
    }),
  }));
  gameState.newGame(7);
});

describe('weekly confirmation and recovery', () => {
  it('does not advance or save until the confirmation is accepted', () => {
    endWeekFlow();
    expect(gameState.week).toBe(1);
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.callbacks.get('#week-cancel')!();
    expect(gameState.week).toBe(1);
    expect(mocks.closeModal).toHaveBeenCalled();
  });

  it('settles exactly once and displays a real recap before the event', () => {
    endWeekFlow();
    const confirm = mocks.callbacks.get('#week-confirm')!;
    confirm();
    confirm();
    expect(gameState.week).toBe(2);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.openModal.mock.lastCall?.[0].title).toBe('第 1 周经营回顾');
    expect(mocks.event).not.toHaveBeenCalled();
    expect(mocks.callbacks.has('#week-next')).toBe(true);
  });

  it('restores a pending event without advancing the week', () => {
    gameState.setFlag(pendingEventFlag(1, 'neighbour'));
    resumePendingWeek();
    expect(mocks.event.mock.lastCall?.[0].id).toBe('neighbour');
    expect(gameState.week).toBe(1);
  });

  it('reports a storage failure while keeping the settled state in memory', () => {
    mocks.save.mockReturnValue(false);
    endWeekFlow();
    mocks.callbacks.get('#week-confirm')!();
    expect(gameState.week).toBe(2);
    expect(mocks.toast.mock.lastCall?.[0]).toContain('未能保存');
  });

  it('opens the existing result when the run has already ended', () => {
    const data = gameState.toData();
    data.run.ended = true;
    gameState.load(data);
    resumePendingWeek();
    expect(mocks.result).toHaveBeenCalledTimes(1);
    expect(mocks.event).not.toHaveBeenCalled();
  });
});
