import { describe, expect, it } from 'vitest';
import { createAnimal } from '../src/sim/animal';
import { captureMetrics, ensureTracking } from '../src/sim/history';
import { applyAction, createRun, endWeek, resolveEvent } from '../src/sim/run';
import { createWinterChallenge } from '../src/sim/scenarios';
import type { Action, Decision, RunState } from '../src/sim/types';
import { deriveWeekAttribution, INCOMPLETE_WEEK_ATTRIBUTION, recordedWeekAttributions } from '../src/ui/attribution';
import { weekHistoryMarkup } from '../src/ui/panels/reviewView';

function recordedStart(overrides: Partial<RunState> = {}): RunState {
  const { tracking: _tracking, ...base } = createRun(7);
  return ensureTracking({ ...base, ...overrides }, 'new-run');
}

function settleActions(actions: Action[], before = recordedStart()) {
  let active = before;
  for (const action of actions) active = applyAction(active, action);
  return { before, active, after: endWeek(active), decisions: active.tracking!.pending };
}

function textFor(week: ReturnType<typeof settleActions>): string {
  const lines = deriveWeekAttribution(week.before, week.after, week.decisions);
  expect(lines.length).toBeGreaterThanOrEqual(1);
  expect(lines.length).toBeLessThanOrEqual(2);
  expect(lines.join('')).not.toMatch(/预计|将会/);
  return lines.join(' ');
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
}

describe('observed weekly attribution', () => {
  it('connects verified grazing intake to the whole-week pasture change', () => {
    const text = textFor(settleActions([{ kind: 'graze', cellId: 'P1' }]));
    expect(text).toContain('P1 区放牧采食 1,080 kg');
    expect(text).toContain('草量减少 1,080 kg');
    expect(text).toContain('退化增加 12 个百分点');
    expect(text).toContain('周结算共同影响');
  });

  it('recovers the cut-hay inventory gain that is already absent from the settlement snapshot', () => {
    const week = settleActions([{ kind: 'cut-hay', cellId: 'P1' }]);
    expect(week.active.pasture[0].biomassKgPerHa).toBe(week.after.pasture[0].biomassKgPerHa);
    const text = textFor(week);
    expect(text).toContain('P1 区割草入库 180 kg');
    expect(text).toContain('草量减少 180 kg');
  });

  it('keeps actual hay purchase expenditure separate from the net weekly cash loss', () => {
    const sheep = createAnimal({ id: 'one', tag: 'S-1', species: 'sheep', sex: 'female', ageWeeks: 100, weightKg: 40 });
    const week = settleActions([{ kind: 'buy-hay', kg: 1000 }], recordedStart({ animals: [sheep], money: 10000, hayKg: 100, labor: 1 }));
    const text = textFor(week);
    expect(text).toContain('购草入库 1,000 kg、支出 ¥1,760');
    expect(text).toContain('现金减少 ¥2,020');
    expect(text).toContain('干草库存增加 989 kg');
    expect(text).toContain('全周合计现金');
    expect(text).not.toContain('支出 ¥2,020');
  });

  it('attributes only the deterministic treatment recovery and labels the combined weekly health change', () => {
    const sheep = { ...createAnimal({ id: 'sick', tag: 'S-1', species: 'sheep', sex: 'female', ageWeeks: 100, weightKg: 40 }), health: 'sick' as const };
    const text = textFor(settleActions([{ kind: 'vet' }], recordedStart({ animals: [sheep] })));
    expect(text).toContain('治疗当时使 1 头患畜恢复健康');
    expect(text).toContain('健康个体增加 1 头');
    expect(text).toContain('平均 BCS 3.00→3.05');
    expect(text).toContain('饲喂、疫病共同影响');
  });

  it('describes vaccination alongside observed health without claiming it caused a random recovery', () => {
    const sheep = { ...createAnimal({ id: 'sick', tag: 'S-1', species: 'sheep', sex: 'female', ageWeeks: 100, weightKg: 40 }), health: 'sick' as const };
    const text = textFor(settleActions([{ kind: 'tech', tech: 'vaccine' }], recordedStart({ animals: [sheep] })));
    expect(text).toContain('记录了全群免疫');
    expect(text).toContain('健康个体增加 1 头');
    expect(text).toContain('饲喂、疫病共同影响');
    expect(text).not.toMatch(/免疫(?:使|令|带来|导致)/);
  });

  it('reports a real sale using actual sold count and observed head and sheep-unit changes', () => {
    const yak = createAnimal({ id: 'yak', tag: 'B-1', species: 'yak', sex: 'female', ageWeeks: 210 });
    const sheep = createAnimal({ id: 'sheep', tag: 'S-1', species: 'sheep', sex: 'female', ageWeeks: 100 });
    const text = textFor(settleActions([{ kind: 'sell', animalIds: ['sheep'] }], recordedStart({ animals: [yak, sheep] })));
    expect(text).toContain('实际出售 1 头');
    expect(text).toContain('存栏 2→1 头');
    expect(text).toContain('羊单位 6.0→5.0');
  });

  it('uses a neutral recap with the actual unspent points when no eligible change exists', () => {
    const text = textFor(settleActions([], recordedStart({ animals: [], pasture: [], labor: 0 })));
    expect(text).toContain('没有可核验的行动归因');
    expect(text).toContain('剩余 3 点行动未使用');
    expect(text).not.toMatch(/放牧|购草|治疗|出售/);
  });

  it('falls back for missing historical decisions and does not invent an idle week', () => {
    const week = settleActions([{ kind: 'buy-hay', kg: 1000 }]);
    expect(deriveWeekAttribution(week.before, week.after)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
    const old = JSON.parse(JSON.stringify(week.after)) as RunState;
    delete (old.tracking!.weeks[0] as { decisions?: Decision[] }).decisions;
    expect(recordedWeekAttributions(old).get(1)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
    expect(() => weekHistoryMarkup(old)).not.toThrow();
    expect(weekHistoryMarkup(old)).toContain(INCOMPLETE_WEEK_ATTRIBUTION);
    expect(weekHistoryMarkup(old)).not.toContain('休整，无已记录选择');
    expect(recordedWeekAttributions({ ...old, tracking: undefined }).size).toBe(0);
  });

  it('uses an explicit boundary for the partial continued-origin week but reconstructs later weeks', () => {
    const initial = settleActions([{ kind: 'buy-hay', kg: 100 }]).active;
    const { tracking: _tracking, ...raw } = initial;
    const continued = ensureTracking(raw, 'continued');
    const first = endWeek(continued);
    const second = endWeek(applyAction(first, { kind: 'cut-hay', cellId: 'P2' }));
    expect(recordedWeekAttributions(second).get(1)?.join('')).toContain('续玩起点');
    expect(recordedWeekAttributions(second).get(1)?.join('')).toContain('无法完整归因');
    expect(recordedWeekAttributions(second).get(2)?.join('')).toContain('P2 区割草入库');
    expect(recordedWeekAttributions(second).has(3)).toBe(false);
  });

  it('includes a real event effect in the observed diff and labels joint effects', () => {
    const before = recordedStart();
    const active = resolveEvent(applyAction(before, { kind: 'graze', cellId: 'P1' }), 'rodents', 'ignore');
    const text = textFor({ before, active, after: endWeek(active), decisions: active.tracking!.pending });
    expect(text).toContain('退化增加 16 个百分点');
    expect(text).toContain('事件与周结算共同影响');
    expect(text).not.toContain('鼠害使');
  });

  it('selects one concise class in pasture, cash, health, sale priority order', () => {
    const base = recordedStart();
    const before = recordedStart({ animals: base.animals.map((animal, index) => index === 0 ? { ...animal, health: 'sick' as const } : animal) });
    const text = textFor(settleActions([{ kind: 'graze', cellId: 'P1' }, { kind: 'buy-hay', kg: 1000 }, { kind: 'vet' }], before));
    expect(text).toContain('P1 区放牧');
    expect(text).not.toContain('购草入库');
    expect(text).not.toContain('治疗当时');
    const pastureOnly = textFor(settleActions([{ kind: 'cut-hay', cellId: 'P1' }, { kind: 'graze', cellId: 'P2' }]));
    expect(pastureOnly).toContain('P1 区割草');
    expect(pastureOnly).not.toContain('P2 区放牧');
  });

  it('derives identical current and historical sentences, including the winter challenge', () => {
    const week = settleActions([{ kind: 'buy-hay', kg: 1000 }], createWinterChallenge());
    const direct = deriveWeekAttribution(week.before, week.after, week.decisions);
    expect(direct.join('')).toContain('购草入库 1,000 kg、支出 ¥2,400');
    expect(recordedWeekAttributions(week.after).get(10)).toEqual(direct);
    const later = endWeek(applyAction(week.after, { kind: 'cut-hay', cellId: 'P2' }));
    expect(recordedWeekAttributions(later).get(10)).toEqual(direct);
    for (const sentence of direct) expect(weekHistoryMarkup(later)).toContain(sentence);
  });

  it('rejects inconsistent replay evidence instead of attributing maintenance cost to an old purchase', () => {
    const week = settleActions([{ kind: 'buy-hay', kg: 1000 }]);
    expect(deriveWeekAttribution(week.active, week.after, week.decisions)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
    const altered = JSON.parse(JSON.stringify(week.after)) as RunState;
    altered.tracking!.weeks[0].metrics.money -= 1;
    expect(recordedWeekAttributions(altered).get(1)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
  });

  it('withholds earlier sentences when a later record cannot verify the full replay chain', () => {
    const first = settleActions([{ kind: 'graze', cellId: 'P1' }]);
    const later = endWeek(applyAction(first.after, { kind: 'cut-hay', cellId: 'P2' }));
    later.tracking!.weeks[1].metrics.money -= 1;
    const sentences = recordedWeekAttributions(later);
    expect(sentences.get(1)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
    expect(sentences.get(2)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
  });

  it('verifies the current week pending choices without settling them or changing earlier sentences', () => {
    const week = settleActions([{ kind: 'graze', cellId: 'P1' }]);
    const expected = recordedWeekAttributions(week.after).get(1);
    const active = applyAction(resolveEvent(week.after, 'rodents', 'ignore'), { kind: 'cut-hay', cellId: 'P2' });
    expect(active.tracking!.pending).toHaveLength(2);
    const snapshot = JSON.stringify(active);
    expect(recordedWeekAttributions(active).get(1)).toEqual(expected);
    expect(JSON.stringify(active)).toBe(snapshot);
    expect(active.week).toBe(2);
    const inconsistent = structuredClone(active);
    inconsistent.tracking!.pending.push({ kind: 'action', action: { kind: 'cut-hay', cellId: 'P2' } });
    expect(recordedWeekAttributions(inconsistent).get(1)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
  });

  it('rejects a different calendar interval even when the displayed physical metrics match', () => {
    const week = settleActions([], recordedStart({ animals: [], pasture: [], labor: 0 }));
    expect(deriveWeekAttribution(week.before, { ...week.after, week: 9 }, week.decisions)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
    expect(deriveWeekAttribution(week.before, { ...week.after, ended: true }, week.decisions)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
  });

  it('rejects a different pasture outcome even when all aggregate metrics match', () => {
    const week = settleActions([{ kind: 'graze', cellId: 'P1' }]);
    const observed = structuredClone(week.after);
    const firstBiomass = observed.pasture[0].biomassKgPerHa;
    observed.pasture[0].biomassKgPerHa = observed.pasture[1].biomassKgPerHa;
    observed.pasture[1].biomassKgPerHa = firstBiomass;
    expect(captureMetrics(observed)).toEqual(captureMetrics(week.after));
    expect(observed.pasture[0].biomassKgPerHa).not.toBe(week.after.pasture[0].biomassKgPerHa);
    expect(deriveWeekAttribution(week.before, observed, week.decisions)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
    expect(recordedWeekAttributions(observed).get(1)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
  });

  it('rejects different individuals\' health outcomes when healthy count and all aggregates match', () => {
    const base = recordedStart();
    const before = recordedStart({ animals: base.animals.map((animal, index) => index === 0 ? { ...animal, health: 'sick' as const }
      : index === 1 ? { ...animal, health: 'subclinical' as const } : animal) });
    const week = settleActions([{ kind: 'vet' }], before);
    const observed = structuredClone(week.after);
    const healthy = observed.animals.find(animal => animal.alive && animal.health === 'healthy')!;
    const subclinical = observed.animals.find(animal => animal.alive && animal.health === 'subclinical')!;
    expect(healthy).toBeDefined();
    expect(subclinical).toBeDefined();
    healthy.health = 'subclinical';
    subclinical.health = 'healthy';
    expect(captureMetrics(observed)).toEqual(captureMetrics(week.after));
    expect(deriveWeekAttribution(week.before, observed, week.decisions)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
    expect(recordedWeekAttributions(observed).get(1)).toEqual([INCOMPLETE_WEEK_ATTRIBUTION]);
  });

  it('allows post-settlement UI flags without confusing them with physical evidence', () => {
    const week = settleActions([{ kind: 'buy-hay', kg: 1000 }]);
    const observed = { ...week.after, flags: { ...week.after.flags, 'pending-event-2-example': true } };
    expect(deriveWeekAttribution(week.before, observed, week.decisions))
      .toEqual(deriveWeekAttribution(week.before, week.after, week.decisions));
    expect(recordedWeekAttributions(observed).get(1)).toEqual(recordedWeekAttributions(week.after).get(1));
  });

  it('never changes input snapshots, recorded choices, numerical metrics or persisted fields', () => {
    const week = settleActions([{ kind: 'graze', cellId: 'P1' }, { kind: 'buy-hay', kg: 1000 }]);
    const snapshot = JSON.stringify(week);
    const metrics = captureMetrics(week.after);
    freeze(week);
    deriveWeekAttribution(week.before, week.after, week.decisions as Decision[]);
    recordedWeekAttributions(week.after);
    weekHistoryMarkup(week.after);
    expect(JSON.stringify(week)).toBe(snapshot);
    expect(captureMetrics(week.after)).toEqual(metrics);
    expect(Object.keys(week.after.tracking!).sort()).toEqual(['baseline', 'origin', 'pending', 'provenance', 'version', 'weeks']);
  });
});
