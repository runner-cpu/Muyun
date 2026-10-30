import { ui } from './instance';
import { openHerdPanel } from './panels/herd';
import { openPasturePanel } from './panels/pasture';
import { openMarketPanel } from './panels/market';
import { openTechPanel } from './panels/tech';
import { openOverviewPanel } from './panels/overview';
import { openGuidePanel } from './panels/guide';
import { openFieldNotes } from './panels/fieldnotes';
import { closeHudSection } from './HudLayout';
import { openOnboarding } from './onboarding';

const PANELS: Record<string, () => void> = {
  herd: openHerdPanel, pasture: () => openPasturePanel(), market: openMarketPanel, tech: openTechPanel,
};

export function bindRanchNavigation(): () => void {
  const abort = new AbortController();
  const options = { signal: abort.signal };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-panel]')) {
    button.addEventListener('click', () => {
      if (!ui.isBlocking()) { closeHudSection('tools'); PANELS[button.dataset.panel!]?.(); }
    }, options);
  }
  for (const id of ['btn-overview', 'btn-overview-top']) {
    document.getElementById(id)?.addEventListener('click', () => {
      if (!ui.isBlocking()) { closeHudSection('note'); closeHudSection('status'); openOverviewPanel(); }
    }, options);
  }
  const help = (action: () => void): void => { if (!ui.isBlocking()) { closeHudSection('help'); action(); } };
  document.getElementById('btn-ranch-guide')?.addEventListener('click', () => help(() => openGuidePanel(true)), options);
  document.getElementById('btn-fieldnotes')?.addEventListener('click', () => help(() => openFieldNotes(ui)), options);
  document.getElementById('btn-onboarding')?.addEventListener('click', () => help(openOnboarding), options);
  document.getElementById('btn-hud-settings')?.addEventListener('click', () => help(() => ui.openSettings()), options);
  window.addEventListener('keydown', (event) => {
    if (ui.isBlocking() || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement)?.closest('input, textarea, select, button, summary, [contenteditable="true"]')) return;
    const panel = ['herd', 'pasture', 'market', 'tech'][Number(event.key) - 1];
    if (panel) { event.preventDefault(); PANELS[panel](); }
  }, options);
  return () => abort.abort();
}
