import { describe, expect, it } from 'vitest';
import { chance, mulberry32, pick, rangeInt } from '../../src/sim/rng';

describe('deterministic rng', () => {
  it('replays the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const left = [a(), a(), a(), a(), a()];
    const right = [b(), b(), b(), b(), b()];
    expect(left).toEqual(right);
  });

  it('produces a different sequence for a different seed', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('stays inside [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('picks an element from the list', () => {
    const rng = mulberry32(11);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i++) expect(items).toContain(pick(rng, items));
  });

  it('keeps integer ranges inclusive on both ends', () => {
    const rng = mulberry32(3);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const value = rangeInt(rng, 2, 5);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(5);
      seen.add(value);
    }
    expect(seen).toEqual(new Set([2, 3, 4, 5]));
  });

  it('treats chance(0) as never and chance(1) as always', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 100; i++) {
      expect(chance(rng, 0)).toBe(false);
      expect(chance(rng, 1)).toBe(true);
    }
  });
});
