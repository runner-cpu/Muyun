import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ openModal: vi.fn() }));
vi.mock('../src/ui/instance', () => ({ ui: mocks }));
import { openHistoryPanel } from '../src/ui/panels/history';
import { gameState } from '../src/core/GameState';
import { recordedWeekAttributions } from '../src/ui/attribution';

afterEach(() => vi.unstubAllGlobals());

describe('局中逐周复盘', () => {
  it('reuses actual recorded attribution, returns to overview and never writes a save', () => {
    gameState.newGame(123);
    gameState.act({ kind: 'graze', cellId: 'P1' });
    gameState.endWeek();
    const before = gameState.toData();
    const write = vi.fn();
    vi.stubGlobal('localStorage', { setItem: write });
    const back = new EventTarget();
    mocks.openModal.mockReturnValue({ querySelector: () => back });
    const onBack = vi.fn();
    openHistoryPanel(onBack);
    const options = mocks.openModal.mock.calls.at(-1)![0];
    expect(options.title).toBe('逐周经营复盘');
    expect(options.body).toContain(recordedWeekAttributions(gameState.run).get(1)![0]);
    expect(options.body).toContain('data-attribution-week="1"');
    back.dispatchEvent(new Event('click'));
    expect(onBack).toHaveBeenCalledOnce();
    expect(gameState.toData()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
  });
});
