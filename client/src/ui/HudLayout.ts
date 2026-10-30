export const HUD_LAYOUT_KEY = 'muyun-hud-layout-v1';
export const HUD_SECTIONS = ['status', 'note', 'tools', 'turn', 'help'] as const;
export type HudSection = typeof HUD_SECTIONS[number];

let sessionSection: HudSection | null | undefined;

/** Layout preferences are independent from both game-save slots. */
export function parseHudLayout(raw: string | null): HudSection | null {
  if (!raw || raw.length > 256) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const expanded = (value as { expanded?: unknown }).expanded;
    return HUD_SECTIONS.includes(expanded as HudSection) ? expanded as HudSection : null;
  } catch { return null; }
}

function remember(section: HudSection | null): void {
  sessionSection = section;
  try { localStorage.setItem(HUD_LAYOUT_KEY, JSON.stringify({ expanded: section })); } catch { /* Keep a session preference when browser storage is blocked. */ }
}

export function closeHudSection(section: HudSection): void {
  const panel = document.querySelector<HTMLDetailsElement>(`[data-hud-section="${section}"]`);
  if (!panel?.open) return;
  if (panel.contains(document.activeElement)) panel.querySelector('summary')?.focus({ preventScroll: true });
  panel.open = false;
}

/** Native summaries keep keyboard and touch behavior; only one drawer stays open. */
export function bindHudLayout(): () => void {
  const panels = Array.from(document.querySelectorAll<HTMLDetailsElement>('[data-hud-section]'));
  if (sessionSection === undefined) {
    try { sessionSection = parseHudLayout(localStorage.getItem(HUD_LAYOUT_KEY)); }
    catch { sessionSection = null; }
  }
  for (const panel of panels) panel.open = panel.dataset.hudSection === sessionSection;
  const labels = (): void => {
    for (const panel of panels) {
      const label = panel.querySelector<HTMLElement>('[data-fold-state]');
      if (label) label.textContent = panel.open ? '收起' : '展开';
    }
  };
  labels();
  const onToggle = (event: Event): void => {
    const source = event.currentTarget as HTMLDetailsElement;
    if (source.open) for (const panel of panels) if (panel !== source) panel.open = false;
    labels();
    const open = panels.find(panel => panel.open)?.dataset.hudSection as HudSection | undefined;
    remember(open ?? null);
  };
  for (const panel of panels) panel.addEventListener('toggle', onToggle);
  return () => { for (const panel of panels) panel.removeEventListener('toggle', onToggle); };
}
