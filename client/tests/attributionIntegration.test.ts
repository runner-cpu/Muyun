import { beforeEach, describe, expect, it, vi } from 'vitest';

const modal = vi.hoisted(() => ({
  callbacks: new Map<string, () => void>(),
  bodies: [] as string[],
  close: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../src/ui/instance', () => ({ ui: {
  openModal: (options: { body: string }) => {
    modal.bodies.push(options.body);
    return { querySelector: (selector: string) => ({
      addEventListener: (_event: string, callback: () => void) => modal.callbacks.set(selector, callback),
    }) };
  },
  closeModal: modal.close,
  toast: vi.fn(),
} }));
vi.mock('../src/systems/SaveSystem', () => ({ saveSystem: { save: modal.save } }));
vi.mock('../src/ui/panels/event', () => ({ openEventPanel: vi.fn() }));
vi.mock('../src/ui/panels/result', () => ({ openResultPanel: vi.fn() }));

import { gameState } from '../src/core/GameState';
import { captureMetrics } from '../src/sim/history';
import { eventChoiceStatus } from '../src/sim/rules';
import { endWeek } from '../src/sim/run';
import { endWeekFlow } from '../src/systems/WeekFlow';
import { INCOMPLETE_WEEK_ATTRIBUTION, recordedWeekAttributions } from '../src/ui/attribution';
import { weekHistoryMarkup } from '../src/ui/panels/reviewView';
import { pendingEventFlag } from '../src/ui/ranchView';

beforeEach(() => {
  vi.clearAllMocks();
  modal.bodies.length = 0;
  modal.callbacks.clear();
  modal.save.mockReturnValue(true);
  gameState.newGame(7);
});

describe('weekly attribution presentation', () => {
  it('puts the identical derived sentences at the top of settlement and inside the history detail', () => {
    gameState.act({ kind: 'graze', cellId: 'P1' });
    gameState.act({ kind: 'buy-hay', kg: 1000 });
    endWeekFlow();
    modal.callbacks.get('#week-confirm')!();
    const settlement = modal.bodies.at(-1)!;
    const history = weekHistoryMarkup(gameState.run);
    const sentences = recordedWeekAttributions(gameState.run).get(1)!;
    expect(sentences).toHaveLength(1);
    for (const sentence of sentences) {
      expect(settlement).toContain(sentence);
      expect(history).toContain(sentence);
      expect(settlement.indexOf(sentence)).toBeLessThan(settlement.indexOf('settlement-delta'));
      expect(history.indexOf(sentence)).toBeGreaterThan(history.indexOf('<details>'));
    }
    expect(modal.callbacks.has('#week-next')).toBe(true);
  });

  it('keeps confirmed settlement values and the saved schema identical to direct simulation', () => {
    gameState.act({ kind: 'buy-hay', kg: 1000 });
    const expected = endWeek(gameState.toData().run);
    endWeekFlow();
    const confirm = modal.callbacks.get('#week-confirm')!;
    confirm();
    confirm();
    expect(captureMetrics(gameState.run)).toEqual(captureMetrics(expected));
    expect(gameState.run.tracking).toEqual(expected.tracking);
    expect(modal.save).toHaveBeenCalledTimes(1);
    const persisted = modal.save.mock.calls[0][0];
    const sentences = recordedWeekAttributions(gameState.run).get(1)!;
    for (const sentence of sentences) expect(JSON.stringify(persisted)).not.toContain(sentence);
    modal.callbacks.get('#week-next')!();
    expect(modal.close).toHaveBeenCalledWith(true);
  });

  it('preserves the settlement sentence after an actual next-week event and action', () => {
    gameState.newGame(2); // This recorded seed offers a real opening event in week 2.
    gameState.act({ kind: 'graze', cellId: 'P1' });
    endWeekFlow();
    modal.callbacks.get('#week-confirm')!();
    const sentences = recordedWeekAttributions(gameState.run).get(1)!;
    const card = gameState.weekEvent()!;
    expect(gameState.hasFlag(pendingEventFlag(gameState.week, card.id))).toBe(true);
    expect(sentences).not.toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
    const choice = card.choices.find(item => !eventChoiceStatus(gameState.run, card.id, item.id).reason)!;
    gameState.resolveEvent(card.id, choice.id);
    gameState.setFlag(pendingEventFlag(gameState.week, card.id), false);
    gameState.act({ kind: 'cut-hay', cellId: 'P2' });
    expect(gameState.run.tracking!.pending).toHaveLength(2);
    const active = gameState.toData();
    const history = weekHistoryMarkup(gameState.run);
    expect(recordedWeekAttributions(gameState.run).get(1)).toEqual(sentences);
    for (const sentence of sentences) {
      expect(modal.bodies.at(-1)).toContain(sentence);
      expect(history).toContain(sentence);
    }
    expect(history).not.toContain(INCOMPLETE_WEEK_ATTRIBUTION);
    expect(gameState.toData()).toEqual(active);
  });

  it('shows the explicit fallback in history when physical outcomes differ despite equal metrics', () => {
    gameState.act({ kind: 'graze', cellId: 'P1' });
    endWeekFlow();
    modal.callbacks.get('#week-confirm')!();
    const sentence = recordedWeekAttributions(gameState.run).get(1)![0];
    const altered = gameState.toData();
    const first = altered.run.pasture[0];
    const second = altered.run.pasture[1];
    [first.biomassKgPerHa, second.biomassKgPerHa] = [second.biomassKgPerHa, first.biomassKgPerHa];
    expect(captureMetrics(altered.run)).toEqual(captureMetrics(gameState.run));
    gameState.load(altered);
    const history = weekHistoryMarkup(gameState.run);
    expect(history).toContain(INCOMPLETE_WEEK_ATTRIBUTION);
    expect(history).not.toContain(sentence);
    expect(gameState.toData()).toEqual(altered);
  });
});
