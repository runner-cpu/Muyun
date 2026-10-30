import { ui } from './instance';
import { openHerdPanel } from './panels/herd';
import { openPasturePanel } from './panels/pasture';
import { openMarketPanel } from './panels/market';
import { openTechPanel } from './panels/tech';
import { openOverviewPanel } from './panels/overview';
import { openGuidePanel } from './panels/guide';
import { openFieldNotes } from './panels/fieldnotes';

const PANELS: Record<string, () => void> = {
  herd: openHerdPanel, pasture: () => openPasturePanel(), market: openMarketPanel, tech: openTechPanel,
};

export function bindRanchNavigation(): () => void {
  const abort = new AbortController();
  const options = { signal: abort.signal };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-panel]')) {
    button.addEventListener('click', () => {
      if (!ui.isBlocking()) PANELS[button.dataset.panel!]?.();
    }, options);
  }
  for (const id of ['btn-overview', 'btn-overview-top', 'btn-overview-risk']) {
    document.getElementById(id)?.addEventListener('click', () => { if (!ui.isBlocking()) openOverviewPanel(); }, options);
  }
  document.getElementById('btn-ranch-guide')?.addEventListener('click', () => { if (!ui.isBlocking()) openGuidePanel(true); }, options);
  document.getElementById('btn-fieldnotes')?.addEventListener('click', () => { if (!ui.isBlocking()) openFieldNotes(ui); }, options);
  window.addEventListener('keydown', (event) => {
    if (ui.isBlocking() || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement)?.closest('input, textarea, select, button')) return;
    const panel = ['herd', 'pasture', 'market', 'tech'][Number(event.key) - 1];
    if (panel) { event.preventDefault(); PANELS[panel](); }
  }, options);
  return () => abort.abort();
}
