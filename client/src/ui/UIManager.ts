import { bus } from '../core/emitter';
import { gameState } from '../core/GameState';
import { audio } from '../systems/AudioManager';
import { saveSystem } from '../systems/SaveSystem';
import { seasonForWeek, seasonLabel, weekLabel } from '../systems/Calendar';
import { DialogueBox } from './dialoguebox';

interface ModalOptions {
  title: string;
  subtitle?: string;
  body: string;
  closable?: boolean;
  onClose?: () => void;
}

export class UIManager {
  readonly dialogue = new DialogueBox();
  onNewGame: (() => void) | null = null;
  onContinue: (() => void) | null = null;
  onEndWeek: (() => void) | null = null;

  private loading = document.getElementById('loading-screen')!;
  private loadingFill = document.getElementById('loading-fill')!;
  private loadingText = document.getElementById('loading-text')!;
  private title = document.getElementById('title-screen')!;
  private hud = document.getElementById('hud')!;
  private prompt = document.getElementById('prompt')!;
  private promptText = document.getElementById('prompt-text')!;
  private toastRoot = document.getElementById('toast-root')!;
  private modalRoot = document.getElementById('modal-root')!;
  private modalCard = document.getElementById('modal-card')!;
  private fadeEl = document.getElementById('fade')!;
  private modalClosable = true;
  private modalOnClose: (() => void) | null = null;

  constructor() {
    document.getElementById('btn-new')?.addEventListener('click', () => this.onNewGame?.());
    document.getElementById('btn-continue')?.addEventListener('click', () => this.onContinue?.());
    document.getElementById('btn-title-settings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('btn-end-week')?.addEventListener('click', () => this.onEndWeek?.());
    this.dialogue.setOpenCallback(() => undefined);
    bus.on('state:changed', () => this.updateHud());
    bus.on('calendar:changed', () => this.updateHud());
    window.addEventListener('keydown', this.onEscape);
  }

  showLoading(): void { this.loading.classList.remove('hidden'); }
  setLoading(progress: number, text?: string): void {
    this.loadingFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    if (text) this.loadingText.textContent = text;
  }
  hideLoading(): void { this.loading.classList.add('hidden'); }

  showTitle(hasSave: boolean): void {
    this.hideLoading();
    this.title.classList.remove('hidden');
    const continueBtn = document.getElementById('btn-continue') as HTMLButtonElement | null;
    if (continueBtn) continueBtn.disabled = !hasSave;
  }
  hideTitle(): void { this.title.classList.add('hidden'); }

  showHud(): void { this.hud.classList.remove('hidden'); this.updateHud(); }
  hideHud(): void { this.hud.classList.add('hidden'); }

  updateHud(): void {
    if (this.hud.classList.contains('hidden')) return;
    const season = seasonForWeek(gameState.week);
    setText('hud-week', weekLabel(gameState.week));
    setText('hud-season', seasonLabel(season));
    setText('hud-money', gameState.money.toLocaleString('zh-CN'));
    setText('hud-hay', String(gameState.hayKg));
    setText('hud-labor', String(gameState.labor));
    setText('hud-reputation', String(gameState.reputation));
    setText('hud-actions', String(gameState.actionsLeft));
    setText('hud-herd', String(gameState.animals.filter((animal) => animal.alive).length));
    setText('hint-text', gameState.hintText());
    const weekBtn = document.getElementById('btn-end-week') as HTMLButtonElement | null;
    if (weekBtn) weekBtn.textContent = gameState.ended ? '查看结算' : '结束本周';
    audio.setSeason(season);
  }

  showPrompt(text: string): void {
    this.promptText.textContent = text;
    this.prompt.classList.remove('hidden');
  }
  hidePrompt(): void { this.prompt.classList.add('hidden'); }

  toast(text: string, tone: '' | 'good' | 'bad' | 'gold' = '', duration = 1900): void {
    const el = document.createElement('div');
    el.className = `toast ${tone}`.trim();
    el.textContent = text;
    this.toastRoot.appendChild(el);
    while (this.toastRoot.children.length > 3) this.toastRoot.firstElementChild?.remove();
    window.setTimeout(() => el.remove(), duration);
  }

  isModalOpen(): boolean { return !this.modalRoot.classList.contains('hidden'); }
  isBlocking(): boolean { return this.isModalOpen() || this.dialogue.isOpen(); }

  openModal(options: ModalOptions): HTMLElement {
    if (this.isModalOpen()) this.closeModal(true);
    this.modalClosable = options.closable ?? true;
    this.modalOnClose = options.onClose ?? null;
    this.modalCard.innerHTML = `
      <div class="modal-head">
        <div><h2>${options.title}</h2>${options.subtitle ? `<p>${options.subtitle}</p>` : ''}</div>
        ${this.modalClosable ? '<button class="modal-close" aria-label="关闭">×</button>' : ''}
      </div>
      <div class="modal-body">${options.body}</div>`;
    this.modalRoot.classList.remove('hidden');
    this.modalCard.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal());
    this.modalRoot.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());
    return this.modalCard.querySelector('.modal-body') as HTMLElement;
  }

  closeModal(force = false): void {
    if (!this.isModalOpen()) return;
    if (!this.modalClosable && !force) return;
    this.modalRoot.classList.add('hidden');
    this.modalCard.innerHTML = '';
    const callback = this.modalOnClose;
    this.modalOnClose = null;
    callback?.();
  }

  openSettings(): void {
    const s = gameState.settings;
    const body = `
      <div class="setting-row"><label>音乐</label><input id="set-music" type="range" min="0" max="100" value="${Math.round(s.music * 100)}" /><output id="out-music">${Math.round(s.music * 100)}</output></div>
      <div class="setting-row"><label>音效</label><input id="set-sfx" type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}" /><output id="out-sfx">${Math.round(s.sfx * 100)}</output></div>
      <div class="setting-row"><label>静音</label><input id="set-muted" type="checkbox" ${s.muted ? 'checked' : ''} /><span class="modal-note">开启后所有声音关闭</span></div>
      <div class="stat-row">
        <div><b>${gameState.week}</b><span>当前周</span></div>
        <div><b>${gameState.reputation}</b><span>口碑</span></div>
        <div><b>${gameState.animals.filter((a) => a.alive).length}</b><span>存栏</span></div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start">
        <button class="pixel-btn" id="set-fullscreen">切换全屏</button>
        <button class="pixel-btn danger" id="set-reset">清除存档</button>
      </div>
      <p class="modal-note" style="margin-top:14px">存档保存在浏览器 localStorage，每周结算时自动保存。</p>`;
    const el = this.openModal({ title: '设置', body });
    const music = el.querySelector('#set-music') as HTMLInputElement;
    const sfx = el.querySelector('#set-sfx') as HTMLInputElement;
    const muted = el.querySelector('#set-muted') as HTMLInputElement;
    const apply = (): void => {
      const next = { music: Number(music.value) / 100, sfx: Number(sfx.value) / 100, muted: muted.checked };
      gameState.setSettings(next);
      audio.setSettings(next);
      setText('out-music', music.value);
      setText('out-sfx', sfx.value);
    };
    music.addEventListener('input', apply);
    sfx.addEventListener('input', apply);
    muted.addEventListener('change', apply);
    el.querySelector('#set-fullscreen')?.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
    });
    el.querySelector('#set-reset')?.addEventListener('click', () => {
      if (!window.confirm('确定清除本地存档吗？此操作不可撤销。')) return;
      saveSystem.clear();
      gameState.newGame();
      window.location.reload();
    });
  }

  fadeThrough(action: () => void): void {
    this.fadeEl.classList.add('on');
    window.setTimeout(() => {
      action();
      window.setTimeout(() => this.fadeEl.classList.remove('on'), 120);
    }, 320);
  }

  private onEscape = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape') return;
    if (this.isModalOpen()) {
      this.closeModal();
      return;
    }
    if (this.dialogue.isOpen()) return;
    if (!this.title.classList.contains('hidden') || !this.hud.classList.contains('hidden')) this.openSettings();
  };
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
