import { gameState } from '../core/GameState';
import { audio } from '../systems/AudioManager';
import { saveSystem } from '../systems/SaveSystem';
import type { UIManager } from './UIManager';

const THEME_KEY = 'muyun-ui-theme';

export function restoreTheme(): void {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
  } catch { /* Browser storage can be unavailable; system theme remains usable. */ }
}

export function openSettingsPanel(ui: UIManager): void {
  const s = gameState.settings;
  const playing = document.getElementById('app')?.dataset.playing === 'true';
  const scenario = playing ? gameState.run.scenario ?? 'year' : 'year';
  const modeLabel = scenario === 'winter-challenge-v1' ? '越冬挑战' : '完整经营';
  const body = `
    <p class="panel-intro">调到适合自己的声音和光线。</p>
    <div class="setting-row"><label for="set-music">音乐</label><input id="set-music" type="range" min="0" max="100" value="${Math.round(s.music * 100)}" /><output id="out-music">${Math.round(s.music * 100)}</output></div>
    <div class="setting-row"><label for="set-sfx">音效</label><input id="set-sfx" type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}" /><output id="out-sfx">${Math.round(s.sfx * 100)}</output></div>
    <div class="setting-row"><label for="set-muted">静音</label><input id="set-muted" type="checkbox" ${s.muted ? 'checked' : ''} /></div>
    <div class="setting-row"><label for="set-theme">界面外观</label><select id="set-theme"><option value="system">跟随系统</option><option value="light">晨光</option><option value="dark">暮色</option></select></div>
    <p class="modal-note">场景保留四季色彩，外观设置影响经营工具和菜单。</p>
    <div class="modal-actions"><button class="pixel-btn" id="set-fullscreen">切换全屏</button></div>
    <div class="settings-danger"><button class="pixel-btn danger" id="set-reset">清除${modeLabel}存档</button><p class="modal-note">仅清除${modeLabel}存档，保留另一模式进度。每次经营操作和每周结算自动保存到本浏览器。</p></div>`;
  const el = ui.openModal({ title: '设置', body });
  const music = el.querySelector<HTMLInputElement>('#set-music')!;
  const sfx = el.querySelector<HTMLInputElement>('#set-sfx')!;
  const muted = el.querySelector<HTMLInputElement>('#set-muted')!;
  const theme = el.querySelector<HTMLSelectElement>('#set-theme')!;
  theme.value = document.documentElement.dataset.theme ?? 'system';
  const apply = (): void => {
    gameState.setSettings({ music: Number(music.value) / 100, sfx: Number(sfx.value) / 100, muted: muted.checked });
    audio.setSettings(gameState.settings);
    el.querySelector('#out-music')!.textContent = music.value;
    el.querySelector('#out-sfx')!.textContent = sfx.value;
    // The title screen has no active run; preserve the existing save when changing sound.
    const data = playing ? gameState.toData() : saveSystem.load();
    if (data && !saveSystem.save({ ...data, settings: { ...gameState.settings } })) {
      ui.toast('设置暂未保存，浏览器存储可能已满', 'bad');
    }
  };
  music.addEventListener('input', apply);
  sfx.addEventListener('input', apply);
  muted.addEventListener('change', apply);
  theme.addEventListener('change', () => {
    if (theme.value === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme.value;
    try { localStorage.setItem(THEME_KEY, theme.value); } catch { ui.toast('外观设置本次有效，未能写入浏览器存储', 'bad'); }
  });
  el.querySelector('#set-fullscreen')?.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => ui.toast('当前浏览器暂不支持全屏', 'bad'));
  });
  el.querySelector('#set-reset')?.addEventListener('click', () => {
    if (!window.confirm(`确定清除${modeLabel}存档吗？另一模式进度会保留，此操作不可撤销。`)) return;
    if (!saveSystem.clear(scenario, { suppressExitSave: true })) {
      ui.toast('未能清除存档，请检查浏览器存储权限后重试。', 'bad');
      return;
    }
    window.location.reload();
  });
}
