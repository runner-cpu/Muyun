import { createRun, applyAction } from '../sim/run';
import { ensureTracking } from '../sim/history';
import { feedRequirementKg } from '../sim/nutrition';
import { actionStatus } from '../sim/rules';
import { settleDeterministic } from '../sim/settlement';
import type { Action, RunState } from '../sim/types';

/** Restricted, disposable practice configuration; never a persisted ScenarioId. */
const PRACTICE_SEED = 20261112;
export const TUTORIAL_FIXED_HAY_KG = 200;

export interface TutorialSnapshot {
  needKg: number;
  availableKg: number;
  gapKg: number;
  topUpKg: number;
  grazedKg: number;
  boughtKg: number;
  cash: number;
  actionsLeft: number;
  fixedBuyKg: number;
}

export interface TutorialResult extends TutorialSnapshot {
  after: RunState;
  sentence: string;
}

const cloneRun = (state: RunState): RunState => JSON.parse(JSON.stringify(state)) as RunState;
const kg = (value: number): string => value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });

/**
 * One deterministic feeding phase using the unmodified simulation functions.
 * No GameState singleton, calendar, events, SaveSystem or storage are involved.
 */
export class TutorialWeek {
  private run: RunState;
  private result: TutorialResult | null = null;

  constructor() {
    const base = createRun(PRACTICE_SEED);
    this.run = ensureTracking({
      ...base,
      tracking: undefined,
      money: 500,
      hayKg: 0,
      // No hired workers or equipment in this feeding-only practice slice.
      labor: 0,
      animals: base.animals.filter(animal => animal.species === 'yak').slice(0, 8)
        .map(animal => ({ ...animal, weightKg: 300 })),
      pasture: base.pasture.map((cell, index) => ({
        ...cell, biomassKgPerHa: index === 0 ? 250 : 0,
      })),
      actionsLeft: 2,
      log: [],
    }, 'new-run');
  }

  /** Return a copy so presentation code cannot modify the practice state. */
  get state(): RunState { return cloneRun(this.run); }

  get snapshot(): TutorialSnapshot {
    if (this.result) {
      const { after: _after, sentence: _sentence, ...snapshot } = this.result;
      return snapshot;
    }
    const needKg = feedRequirementKg(this.run.animals);
    const availableKg = this.run.grazedKg + this.run.hayKg;
    // Remove floating-point dust only in this display-derived gap (kg).
    // Feeding itself still receives the exact, original RunState values.
    const gapKg = Math.max(0, Math.round((needKg - availableKg) * 1e6) / 1e6);
    const boughtKg = (this.run.tracking?.pending ?? []).reduce((sum, decision) =>
      sum + (decision.kind === 'action' && decision.action.kind === 'buy-hay' ? decision.action.kg : 0), 0);
    return {
      needKg, availableKg, gapKg, topUpKg: Math.ceil(gapKg),
      grazedKg: this.run.grazedKg, boughtKg, cash: this.run.money,
      actionsLeft: this.run.actionsLeft, fixedBuyKg: TUTORIAL_FIXED_HAY_KG,
    };
  }

  /** Only these two action kinds are offered by the restricted view. */
  act(action: Action): boolean {
    if (this.result) return false;
    if (action.kind === 'graze') {
      if (action.cellId !== 'P1') return false;
    } else if (action.kind === 'buy-hay') {
      if (action.kg !== TUTORIAL_FIXED_HAY_KG && action.kg !== this.snapshot.topUpKg) return false;
    } else return false;
    if (actionStatus(this.run, action).reason) return false;
    const next = applyAction(this.run, action);
    if (next === this.run) return false;
    this.run = next;
    return true;
  }

  settle(): TutorialResult {
    if (this.result) return this.result;
    const snapshot = this.snapshot;
    const after = settleDeterministic(this.run);
    const sources = `放牧提供 ${kg(snapshot.grazedKg)} kg，购草补入 ${kg(snapshot.boughtKg)} kg`;
    const outcome = snapshot.gapKg > 0
      ? `实际可用 ${kg(snapshot.availableKg)} kg，距本周需草仍缺 ${kg(snapshot.gapKg)} kg。`
      : `实际可用 ${kg(snapshot.availableKg)} kg，已覆盖本周需草 ${kg(snapshot.needKg)} kg。`;
    this.result = { ...snapshot, after, sentence: `${sources}；${outcome}` };
    this.run = after;
    return this.result;
  }
}
