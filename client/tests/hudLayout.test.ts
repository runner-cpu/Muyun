import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Section = 'status' | 'note' | 'tools' | 'turn' | 'help';
let focused: unknown;
let pendingToggles: Set<Panel>;
let panels: Panel[];
let storage: Map<string, string>;
let layout: typeof import('../src/ui/HudLayout');

class Panel extends EventTarget {
  readonly dataset: { hudSection: Section };
  readonly label = { textContent: '' };
  readonly content = {};
  readonly summary = { focus: vi.fn((_options?: FocusOptions) => { focused = this.summary; }) };
  private expanded = false;

  constructor(section: Section) { super(); this.dataset = { hudSection: section }; }
  get open(): boolean { return this.expanded; }
  set open(value: boolean) {
    if (value === this.expanded) return;
    this.expanded = value;
    // A real details element emits a queued, coalesced toggle rather than
    // dispatching synchronously inside its open setter.
    pendingToggles.add(this);
  }
  contains(node: unknown): boolean { return node === this.summary || node === this.content; }
  querySelector(selector: string): unknown {
    return selector === 'summary' ? this.summary : selector === '[data-fold-state]' ? this.label : null;
  }
}

function flushToggles(): void {
  let rounds = 0;
  while (pendingToggles.size) {
    if (++rounds > 20) throw new Error('Toggle handlers did not settle');
    const queued = [...pendingToggles];
    pendingToggles.clear();
    for (const panel of queued) panel.dispatchEvent(new Event('toggle'));
  }
}

function createPanels(): void {
  panels = (['status', 'note', 'tools', 'turn', 'help'] as const).map(section => new Panel(section));
}

const panelFor = (section: Section): Panel => panels.find(panel => panel.dataset.hudSection === section)!;
const expandedSections = (): Section[] => panels.filter(panel => panel.open).map(panel => panel.dataset.hudSection);

beforeEach(async () => {
  vi.resetModules();
  storage = new Map();
  pendingToggles = new Set();
  focused = null;
  createPanels();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  });
  vi.stubGlobal('document', {
    querySelectorAll: () => panels,
    querySelector: (selector: string) => panels.find(panel => selector === `[data-hud-section="${panel.dataset.hudSection}"]`) ?? null,
    get activeElement() { return focused; },
  });
  layout = await import('../src/ui/HudLayout');
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('牧场 HUD 收纳与布局记忆', () => {
  it('默认全部收起，非法或超长存储不能打开未知区域', () => {
    for (const raw of [null, '', 'invalid', '[]', '"tools"', '{}', '{"expanded":true}', '{"expanded":"unknown"}', ' '.repeat(257)]) {
      expect(layout.parseHudLayout(raw)).toBeNull();
    }
    for (const section of ['status', 'note', 'tools', 'turn', 'help']) {
      expect(layout.parseHudLayout(JSON.stringify({ expanded: section }))).toBe(section);
    }
    storage.set(layout.HUD_LAYOUT_KEY, '{"expanded":"unknown"}');
    const off = layout.bindHudLayout();
    flushToggles();
    expect(expandedSections()).toEqual([]);
    expect(panels.every(panel => panel.label.textContent === '展开')).toBe(true);
    off();
  });

  it('重新进入时只恢复保存的一个栏位，其余栏位和标签保持收起', () => {
    storage.set(layout.HUD_LAYOUT_KEY, '{"expanded":"tools"}');
    const off = layout.bindHudLayout();
    flushToggles();
    expect(expandedSections()).toEqual(['tools']);
    expect(panelFor('tools').label.textContent).toBe('收起');
    expect(panels.filter(panel => panel.dataset.hudSection !== 'tools').every(panel => panel.label.textContent === '展开')).toBe(true);
    off();
  });

  it('五栏逐一打开时互斥，并同步真实展开标签和独立布局偏好', () => {
    const off = layout.bindHudLayout();
    for (const section of ['status', 'note', 'tools', 'turn', 'help'] as const) {
      panelFor(section).open = true;
      flushToggles();
      expect(expandedSections()).toEqual([section]);
      for (const panel of panels) expect(panel.label.textContent).toBe(panel.open ? '收起' : '展开');
      expect(JSON.parse(storage.get(layout.HUD_LAYOUT_KEY)!)).toEqual({ expanded: section });
    }
    panelFor('help').open = false;
    flushToggles();
    expect(expandedSections()).toEqual([]);
    expect(JSON.parse(storage.get(layout.HUD_LAYOUT_KEY)!)).toEqual({ expanded: null });
    expect([...storage.keys()]).toEqual([layout.HUD_LAYOUT_KEY]);
    off();
  });

  it('浏览器存储不可用时仍能互斥收纳，并在卸载重建后保留会话布局', () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('denied'); });
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('denied'); });
    let off = layout.bindHudLayout();
    panelFor('turn').open = true;
    expect(flushToggles).not.toThrow();
    expect(expandedSections()).toEqual(['turn']);
    off();
    createPanels();
    off = layout.bindHudLayout();
    flushToggles();
    expect(expandedSections()).toEqual(['turn']);
    expect(panelFor('turn').label.textContent).toBe('收起');
    off();
  });

  it('程序收起包含焦点的栏位时把焦点还给标题，避免留在隐藏内容', () => {
    const off = layout.bindHudLayout();
    const tools = panelFor('tools');
    tools.open = true;
    flushToggles();
    focused = tools.content;
    layout.closeHudSection('tools');
    flushToggles();
    expect(tools.summary.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(focused).toBe(tools.summary);
    expect(tools.open).toBe(false);
    expect(tools.label.textContent).toBe('展开');
    expect(JSON.parse(storage.get(layout.HUD_LAYOUT_KEY)!)).toEqual({ expanded: null });
    off();
  });

  it('收起其他栏位或已经关闭的栏位时不抢走外部焦点', () => {
    const off = layout.bindHudLayout();
    const outside = {};
    focused = outside;
    const note = panelFor('note');
    note.open = true;
    flushToggles();
    layout.closeHudSection('note');
    layout.closeHudSection('note');
    flushToggles();
    expect(note.summary.focus).not.toHaveBeenCalled();
    expect(focused).toBe(outside);
    off();
  });

  it('卸载移除旧监听，重绑后只响应新栏位且保留最后有效布局', () => {
    const removed = panels.map(panel => vi.spyOn(panel, 'removeEventListener'));
    let off = layout.bindHudLayout();
    panelFor('note').open = true;
    flushToggles();
    off();
    for (const spy of removed) expect(spy).toHaveBeenCalledWith('toggle', expect.any(Function));
    vi.mocked(localStorage.setItem).mockClear();
    // Old detached nodes can still emit, but must no longer change preferences.
    panelFor('tools').open = true;
    flushToggles();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    createPanels();
    off = layout.bindHudLayout();
    flushToggles();
    expect(expandedSections()).toEqual(['note']);
    panelFor('help').open = true;
    flushToggles();
    expect(expandedSections()).toEqual(['help']);
    expect(JSON.parse(storage.get(layout.HUD_LAYOUT_KEY)!)).toEqual({ expanded: 'help' });
    off();
  });
});
