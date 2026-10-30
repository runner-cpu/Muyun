import type { Animal, Species } from '../../sim/types';

export type AnimalFilter = 'all' | Species;
export const ANIMALS_PER_PAGE = 8;
export interface AnimalPage { items: Animal[]; page: number; pageCount: number; total: number; first: number; last: number }

/** Clamp after a sale or filter change so the remaining animals stay reachable. */
export function animalPage(animals: Animal[], filter: AnimalFilter, requestedPage: number): AnimalPage {
  const filtered = animals.filter((animal) => animal.alive && (filter === 'all' || animal.species === filter));
  const pageCount = Math.max(1, Math.ceil(filtered.length / ANIMALS_PER_PAGE));
  const page = Math.max(0, Math.min(pageCount - 1, Math.floor(requestedPage)));
  const start = page * ANIMALS_PER_PAGE;
  const items = filtered.slice(start, start + ANIMALS_PER_PAGE);
  return { items, page, pageCount, total: filtered.length, first: items.length ? start + 1 : 0, last: start + items.length };
}

export function animalFilters(animals: Animal[], filter: AnimalFilter, page: AnimalPage): string {
  const herd = animals.filter((animal) => animal.alive);
  const options: Array<[AnimalFilter, string, number]> = [
    ['all', '全部', herd.length], ['yak', '牦牛', herd.filter((animal) => animal.species === 'yak').length],
    ['sheep', '藏羊', herd.filter((animal) => animal.species === 'sheep').length],
  ];
  return `<div class="panel-toolbar">
    <div class="filter-tabs" role="group" aria-label="按牲畜种类筛选">${options.map(([value, label, count]) =>
      `<button type="button" class="${value === filter ? 'active' : ''}" data-animal-filter="${value}" aria-pressed="${value === filter}">${label} <span>${count}</span></button>`).join('')}</div>
    <p class="modal-note">${page.total ? `显示 ${page.first}-${page.last} 头，共 ${page.total} 头` : '暂无符合条件的牲畜'}</p>
  </div>`;
}

export function animalPagination(page: AnimalPage): string {
  if (page.pageCount <= 1) return '';
  return `<nav class="pagination" aria-label="牲畜列表分页">
    <button type="button" class="pixel-btn tiny" data-animal-page="${page.page - 1}" ${page.page === 0 ? 'disabled' : ''}>上一页</button>
    <span>第 ${page.page + 1} / ${page.pageCount} 页</span>
    <button type="button" class="pixel-btn tiny" data-animal-page="${page.page + 1}" ${page.page === page.pageCount - 1 ? 'disabled' : ''}>下一页</button>
  </nav>`;
}

export function bindAnimalList(root: HTMLElement, filter: AnimalFilter, onChange: (filter: AnimalFilter, page: number) => void): void {
  root.querySelectorAll<HTMLButtonElement>('[data-animal-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextFilter = button.dataset.animalFilter as AnimalFilter;
      onChange(nextFilter, 0);
      root.querySelector<HTMLButtonElement>(`[data-animal-filter="${nextFilter}"]`)?.focus({ preventScroll: true });
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-animal-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const forward = button.textContent === '下一页';
      onChange(filter, Number(button.dataset.animalPage));
      const controls = root.querySelectorAll<HTMLButtonElement>('[data-animal-page]:not(:disabled)');
      const next = forward ? controls.item(controls.length - 1) : controls.item(0);
      (next ?? root.closest<HTMLElement>('[role="dialog"]'))?.focus({ preventScroll: true });
    });
  });
}
