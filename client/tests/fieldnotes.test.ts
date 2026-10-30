import { describe, expect, it } from 'vitest';
import { buildFieldNotes } from '../src/sim/fieldnotes';
import { feedRequirementKg } from '../src/sim/nutrition';
import { createRun } from '../src/sim/run';
import { createWinterChallenge } from '../src/sim/scenarios';
import { snowRisk } from '../src/sim/weather';

describe('contextual plateau field notes', () => {
  it('reports the current feed deficit after known grazing without altering the run', () => {
    const state = createRun(71);
    state.hayKg = 100;
    state.grazedKg = 200;
    const before = JSON.stringify(state);
    const view = buildFieldNotes(state);
    const need = feedRequirementKg(state.animals);
    expect(view.metrics.weeklyFeedKg).toBe(need);
    expect(view.metrics.hayNeededKg).toBe(need - 200);
    expect(view.metrics.hayGapKg).toBe(need - 300);
    expect(view.metrics.hayEquivalentWeeks).toBe(100 / need);
    expect(view.notes[0].id).toBe('winter-reserve');
    expect(view.notes[0].attention).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('never turns spare grazing into negative hay demand or a feed deficit', () => {
    const state = createRun(72);
    state.grazedKg = feedRequirementKg(state.animals) * 2;
    state.hayKg = 0;
    const view = buildFieldNotes(state);
    expect(view.metrics.hayNeededKg).toBe(0);
    expect(view.metrics.hayGapKg).toBe(0);
    expect(view.notes.find(note => note.id === 'winter-reserve')?.attention).toBe(false);
  });

  it('uses the game week risk and keeps it independent from hay reserves', () => {
    const state = createWinterChallenge();
    const before = buildFieldNotes(state);
    state.hayKg += 10_000;
    const after = buildFieldNotes(state);
    expect(after.metrics.snowRisk).toBe(snowRisk(state.week));
    expect(after.metrics.snowRisk).toBe(before.metrics.snowRisk);
    expect(after.metrics.hayEquivalentWeeks).toBeGreaterThan(before.metrics.hayEquivalentWeeks!);
    expect(after.notes.find(note => note.id === 'winter-reserve')?.mechanism).toContain('不会改变暴雪');
  });

  it('excludes grazed, cut and tracking-only use from projected rest benefits', () => {
    const state = createRun(74);
    state.pasture = state.pasture.map(cell => ({
      ...cell, biomassKgPerHa: 100, degradation: 0.2, restedWeeks: 2,
    }));
    state.pasture[0].grazing = true;
    state.pasture[1].harvested = true;
    state.tracking!.pending = [{ kind: 'action', action: { kind: 'cut-hay', cellId: state.pasture[2].id } }];
    const view = buildFieldNotes(state);
    expect(view.metrics.grazedCount).toBe(1);
    expect(view.metrics.cutCount).toBe(2);
    expect(view.metrics.restingCount).toBe(1);
    expect(view.metrics.restGrowthKg).toBeGreaterThan(0);
    expect(view.metrics.restRecoveryPoints).toBeCloseTo(1);
    state.pasture[3].harvested = true;
    const fullyUsed = buildFieldNotes(state);
    expect(fullyUsed.metrics.restingCount).toBe(0);
    expect(fullyUsed.metrics.restGrowthKg).toBe(0);
    expect(fullyUsed.metrics.restRecoveryPoints).toBe(0);
    expect(fullyUsed.metrics.winterGrowthKg).toBe(0);
    expect(fullyUsed.metrics.summerGrowthKg).toBe(0);
  });

  it('changes seasonal growth evidence using the same resting ground', () => {
    const state = createRun(75);
    state.pasture = state.pasture.map(cell => ({ ...cell, biomassKgPerHa: 100 }));
    state.season = 'winter';
    const winter = buildFieldNotes(state);
    state.season = 'summer';
    const summer = buildFieldNotes(state);
    expect(winter.metrics.restGrowthKg).toBe(winter.metrics.winterGrowthKg);
    expect(summer.metrics.restGrowthKg).toBe(summer.metrics.summerGrowthKg);
    expect(winter.metrics.summerGrowthKg).toBe(summer.metrics.summerGrowthKg);
    expect(winter.metrics.winterGrowthKg).toBe(summer.metrics.winterGrowthKg);
    expect(summer.metrics.restGrowthKg).toBeGreaterThan(winter.metrics.restGrowthKg);
    expect(winter.seasonLabel).toBe('冬季');
  });

  it('keeps sheep-unit load separate from body-weight feed demand and excludes departed animals', () => {
    const state = createRun(76);
    const yak = state.animals.find(animal => animal.species === 'yak')!;
    const sheep = state.animals.find(animal => animal.species === 'sheep')!;
    const departed = { ...yak, id: 'departed', alive: false, weightKg: 99_999 };
    state.animals = [yak, sheep, departed];
    const before = buildFieldNotes(state);
    yak.weightKg *= 2;
    const after = buildFieldNotes(state);
    const yakBefore = before.metrics.species.find(item => item.species === 'yak')!;
    const yakAfter = after.metrics.species.find(item => item.species === 'yak')!;
    expect(yakAfter.count).toBe(1);
    expect(yakAfter.sheepUnits).toBe(yakBefore.sheepUnits);
    expect(yakAfter.weeklyFeedKg).toBe(yakBefore.weeklyFeedKg * 2);
    expect(after.metrics.weeklyFeedKg).toBe(feedRequirementKg([yak, sheep]));
    expect(after.metrics.species.reduce((sum, item) => sum + item.weeklyFeedKg, 0)).toBeCloseTo(after.metrics.weeklyFeedKg);
  });

  it('prioritizes uninterrupted pasture recovery when all ground has already been used', () => {
    const state = createRun(77);
    state.hayKg = 100_000;
    state.pasture = state.pasture.map(cell => ({ ...cell, grazing: true }));
    const view = buildFieldNotes(state);
    expect(view.notes[0].id).toBe('rest-recovery');
    expect(view.notes[0].attention).toBe(true);
  });

  it('handles no living animals and no pasture without infinite reserve claims', () => {
    const state = createRun(78);
    state.animals.forEach(animal => { animal.alive = false; });
    state.pasture = [];
    const view = buildFieldNotes(state);
    expect(view.metrics.weeklyFeedKg).toBe(0);
    expect(view.metrics.hayGapKg).toBe(0);
    expect(view.metrics.hayEquivalentWeeks).toBeNull();
    expect(view.metrics.restRecoveryPoints).toBe(0);
    expect(view.notes.find(note => note.id === 'herd-load')?.observation).toContain('没有在栏牲畜');
    expect(JSON.stringify(view)).not.toMatch(/Infinity|NaN/);
    expect(view.notes).toHaveLength(3);
  });
});
