import { describe, expect, it } from 'vitest';
import { drawWeather, isDisaster, snowRisk, weatherLabel } from '../../src/sim/weather';
import { mulberry32 } from '../../src/sim/rng';

const low = () => 0;
const high = () => 0.99;

describe('weather', () => {
  it('raises snow risk as winter approaches', () => {
    expect(snowRisk(10)).toBeGreaterThan(snowRisk(7));
    expect(snowRisk(7)).toBeGreaterThan(snowRisk(3));
  });

  it('keeps snow risk below certainty', () => {
    expect(snowRisk(13)).toBeLessThanOrEqual(0.5);
    expect(snowRisk(1)).toBeGreaterThanOrEqual(0);
  });

  it('rolls a blizzard in winter on a low roll', () => {
    expect(drawWeather(12, low)).toBe('blizzard');
  });

  it('rolls clear weather on a high roll', () => {
    expect(drawWeather(12, high)).toBe('clear');
  });

  it('replays the same weather for the same seed', () => {
    const first = Array.from({ length: 13 }, (_, i) => drawWeather(i + 1, mulberry32(5)));
    const second = Array.from({ length: 13 }, (_, i) => drawWeather(i + 1, mulberry32(5)));
    expect(first).toEqual(second);
  });

  it('flags blizzards as disasters', () => {
    expect(isDisaster('blizzard')).toBe(true);
    expect(isDisaster('snow')).toBe(false);
    expect(isDisaster('clear')).toBe(false);
  });

  it('labels the weather in Chinese', () => {
    expect(weatherLabel('clear')).toBe('晴');
    expect(weatherLabel('blizzard')).toBe('暴雪');
  });
});
