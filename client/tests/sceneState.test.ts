import { describe, expect, it } from 'vitest';
import { pastureAppearance, sampleSceneAnimals } from '../src/world/sceneState';
import type { Animal } from '../src/sim/types';

const animal = (id: string, changes: Partial<Animal> = {}): Animal => ({
  id, tag: id, species: 'yak', sex: 'female', ageWeeks: 100, weightKg: 200,
  bcs: 3, health: 'healthy', pregnant: false, lactating: false, collar: false, alive: true, ...changes,
});

describe('scene state projection', () => {
  it('uses real living records and prioritizes sick and thin animals within each species budget', () => {
    const herd = Array.from({ length: 50 }, (_, index) => animal(`yak-${index}`));
    herd.push(animal('sick', { health: 'sick' }), animal('thin', { bcs: 2 }), animal('gone', { health: 'sick', alive: false }));
    const sampled = sampleSceneAnimals(herd);
    expect(sampled).toHaveLength(18);
    expect(sampled.slice(0, 2).map(item => item.id)).toEqual(['sick', 'thin']);
    expect(sampled.every(item => herd.includes(item) && item.alive)).toBe(true);
    expect(sampleSceneAnimals([...herd].reverse()).map(item => item.id)).toEqual(sampled.map(item => item.id));
  });

  it('keeps small herds visible, budgets each species separately, and does not reorder source records', () => {
    const herd = [animal('a'), animal('b', { species: 'sheep' }), animal('c', { alive: false })];
    expect(sampleSceneAnimals(herd).map(item => item.id)).toEqual(['a', 'b']);
    expect(herd.map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(sampleSceneAnimals([])).toEqual([]);
  });

  it('reduces cover after grazing and exposes more soil as degradation rises', () => {
    const rested = pastureAppearance({ biomassKgPerHa: 900, degradation: 0 });
    const grazed = pastureAppearance({ biomassKgPerHa: 350, degradation: 0 });
    const degraded = pastureAppearance({ biomassKgPerHa: 900, degradation: 0.7 });
    expect(grazed.cover).toBeLessThan(rested.cover);
    expect(grazed.bare).toBeGreaterThan(rested.bare);
    expect(degraded.bare).toBeGreaterThan(rested.bare);
    expect(pastureAppearance({ biomassKgPerHa: -1, degradation: 2 })).toEqual({ cover: 0, bare: 0.9 });
  });
});
