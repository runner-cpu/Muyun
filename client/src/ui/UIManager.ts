import { bus } from '../core/emitter';
import { gameState } from '../core/GameState';
import { audio } from '../systems/AudioManager';
import { saveSystem } from '../systems/SaveSystem';
import { formatTime, phaseFor, phaseLabel } from '../systems/TimeSystem';
import type { CatDef } from '../types';
import catsData from '../data/cats.json';
import { DialogueBox } from './dialoguebox';

const cats = catsData as CatDef[];

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
  private seekHud = document.getElementById('seek-hud')!;
  private modalClosable = true;
  private modalOnClose: (() => void) | null = null;

  constructor() {
    document.getElementById('btn-new')?.addEventListener('click', () => this.onNewGame?.());
    document.getElementById('btn-continue')?.addEventListener('click', () => this.onContinue?.());
    document.getElementById('btn-title-settings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('btn-album')?.addEventListener('click', () => this.openAlbum());
    this.dialogue.setOpenCallback(() => undefined);
    bus.on('state:changed', () => this.updateHud());
    bus.on('time:changed', () => this.updateHud());
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
    const phase = phaseFor(gameState.timeMinutes);
    setText('hud-day', `DAY ${gameState.day}`);
    setText('hud-time', formatTime(gameState.timeMinutes));
    setText('hud-phase', phaseLabel(phase));
    setText('hud-credits', String(gameState.credits));
    setText('hud-mood', String(gameState.mood));
    setText('quest-text', gameState.questText());
    const moodEl = document.getElementById('hud-mood');
    if (moodEl) moodEl.style.color = gameState.mood < 25 ? 'var(--red)' : '';
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

  openAlbum(): void {
    const body = cats.map((cat) => {
      const owned = gameState.hasCat(cat.id);
      const color = ['#e8943a', '#3a3a46', '#e8e8e8', '#e8d8c8', '#9a9aa8'][cat.variant] ?? '#e8943a';
      return `<div class="cat-card ${owned ? '' : 'locked'}">
        <h3><span class="cat-dot" style="background:${color}"></span>${owned ? cat.name : '？？？'}</h3>
        <p>${owned ? cat.description : '还没有在校园里遇到这只猫。'}</p>
        ${cat.petId ? '<span class="tag">可出战</span>' : ''}
      </div>`;
    }).join('');
    this.openModal({
      title: '校园猫图鉴',
      subtitle: `已收集 ${gameState.cats.length} / ${cats.length}`,
      body: `<div class="cat-grid">${body}</div>`,
    });
  }

  openSettings(): void {
    const s = gameState.settings;
    const body = `
      <div class="setting-row"><label>音乐</label><input id="set-music" type="range" min="0" max="100" value="${Math.round(s.music * 100)}" /><output id="out-music">${Math.round(s.music * 100)}</output></div>
      <div class="setting-row"><label>音效</label><input id="set-sfx" type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}" /><output id="out-sfx">${Math.round(s.sfx * 100)}</output></div>
      <div class="setting-row"><label>静音</label><input id="set-muted" type="checkbox" ${s.muted ? 'checked' : ''} /><span class="modal-note">开启后所有声音关闭</span></div>
      <div class="stat-row">
        <div><b>${gameState.day}</b><span>当前天数</span></div>
        <div><b>${gameState.cats.length}</b><span>收集猫</span></div>
        <div><b>${gameState.achievements.length}</b><span>成就</span></div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start">
        <button class="pixel-btn" id="set-fullscreen">切换全屏</button>
        <button class="pixel-btn danger" id="set-reset">清除存档</button>
      </div>
      <p class="modal-note" style="margin-top:14px">存档保存在浏览器 localStorage，每 60 秒、睡觉、收集猫时自动保存。</p>`;
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

  showSeek(): void { this.seekHud.classList.remove('hidden'); }
  hideSeek(): void { this.seekHud.classList.add('hidden'); }
  updateSeek(secondsLeft: number, hint: string, ratio: number): void {
    setText('seek-timer', `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(Math.floor(secondsLeft % 60)).padStart(2, '0')}`);
    setText('seek-hint', hint);
    const bar = document.getElementById('seek-bar-fill');
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
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
