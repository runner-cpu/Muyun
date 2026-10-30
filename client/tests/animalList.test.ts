import { describe, expect, it } from 'vitest';
import { createRun } from '../src/sim/run';
import { animalPage } from '../src/ui/panels/animalList';

describe('牲畜筛选与分页', () => {
  it('初始50头均可翻页访问，没有截断或重复', () => {
    const animals = createRun(31).animals;
    const first = animalPage(animals, 'all', 0);
    const reached = Array.from({ length: first.pageCount }, (_, page) => animalPage(animals, 'all', page).items).flat();
    expect(reached.map((animal) => animal.id)).toEqual(animals.map((animal) => animal.id));
    expect(new Set(reached.map((animal) => animal.id)).size).toBe(50);
    expect(first.items).toHaveLength(8);
    expect(first.pageCount).toBe(7);
  });

  it('藏羊筛选包含全部30头，出售列表不会被高价牦牛挡住', () => {
    const animals = createRun(31).animals;
    const page = animalPage(animals, 'sheep', 0);
    expect(page.total).toBe(30);
    expect(page.pageCount).toBe(4);
    expect(page.items.every((animal) => animal.species === 'sheep')).toBe(true);
    expect(animalPage(animals, 'sheep', 3).items.at(-1)?.id).toBe('sheep-30');
  });

  it('出售末页后自动退到有效页，并排除离栏牲畜', () => {
    const animals = createRun(31).animals;
    animals.slice(48).forEach((animal) => { animal.alive = false; });
    const page = animalPage(animals, 'all', 6);
    expect(page.page).toBe(5);
    expect(page.pageCount).toBe(6);
    expect(page.items).toHaveLength(8);
    expect(page.last).toBe(48);
  });

  it('空列表保持有效页码，显示数量为0', () => {
    expect(animalPage([], 'all', 9)).toEqual({ items: [], page: 0, pageCount: 1, total: 0, first: 0, last: 0 });
    expect(animalPage(createRun(31).animals, 'yak', -1).page).toBe(0);
  });
});
