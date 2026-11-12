import { bus } from '../core/emitter';
import { DialogueBox } from './dialoguebox';
import { renderHud, setText } from './HudView';
import { openSettingsPanel, restoreTheme } from './settings';
import { openGuidePanel } from './panels/guide';
import { closeHudSection } from './HudLayout';

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
  onTutorial: (() => void) | null = null;
  onContinue: (() => void) | null = null;
  onWinterChallenge: (() => void) | null = null;
  onContinueWinter: (() => void) | null = null;
  onReturnTitle: (() => void) | null = null;
  onEndWeek: (() => void) | null = null;

  private loading = document.getElementById('loading-screen')!;
  private loadingFill = document.getElementById('loading-fill')!;
  private loadingText = document.getElementById('loading-text')!;
  private title = document.getElementById('title-screen')!;
  private hud = document.getElementById('hud')!;
  private prompt = document.getElementById('prompt')!;
  private promptText = document.getElementById('prompt-text')!;
  private toastRoot = document.getElementById('toast-root')!;
  private toastHome = this.toastRoot.parentElement!;
  private modalRoot = document.getElementById('modal-root')!;
  private modalCard = document.getElementById('modal-card')!;
  private fadeEl = document.getElementById('fade')!;
  private modalClosable = true;
  private modalOnClose: (() => void) | null = null;
  private previousFocus: HTMLElement | null = null;

  constructor() {
    restoreTheme();
    document.getElementById('loading-retry')?.addEventListener('click', () => window.location.reload());
    document.getElementById('btn-new')?.addEventListener('click', () => this.onNewGame?.());
    document.getElementById('btn-tutorial')?.addEventListener('click', () => this.onTutorial?.());
    document.getElementById('btn-continue')?.addEventListener('click', () => this.onContinue?.());
    document.getElementById('btn-winter')?.addEventListener('click', () => this.onWinterChallenge?.());
    document.getElementById('btn-continue-winter')?.addEventListener('click', () => this.onContinueWinter?.());
    document.getElementById('btn-title-settings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('btn-end-week')?.addEventListener('click', () => { if (!this.isBlocking()) { closeHudSection('turn'); this.onEndWeek?.(); } });
    document.getElementById('btn-guide')?.addEventListener('click', () => { if (!this.isBlocking()) openGuidePanel(); });
    this.modalRoot.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());
    this.modalCard.addEventListener('keydown', this.onModalKeyDown);
    this.dialogue.setOpenCallback(() => undefined);
    bus.on('state:changed', () => this.updateHud());
    bus.on('calendar:changed', () => this.updateHud());
    window.addEventListener('keydown', this.onEscape);
  }

  showLoading(): void { this.loading.classList.remove('hidden'); }
  setLoading(progress: number, text?: string): void {
    this.loadingFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    this.loadingFill.parentElement?.setAttribute('aria-valuenow', String(Math.round(Math.max(0, Math.min(1, progress)) * 100)));
    if (text) this.loadingText.textContent = text;
  }
  hideLoading(): void { this.loading.classList.add('hidden'); }

  showLoadingFailure(count: number): void {
    this.loading.classList.remove('hidden');
    this.loadingText.textContent = `${count} 项牧场资源未能加载。请检查网络后重试，已有存档会保留。`;
    document.getElementById('loading-retry')?.classList.remove('hidden');
    this.loadingFill.parentElement?.setAttribute('aria-label', '牧场资源加载未完成');
  }

  showTitle(hasSave: boolean): void {
    this.hideLoading();
    this.title.classList.remove('hidden');
    const continueBtn = document.getElementById('btn-continue') as HTMLButtonElement | null;
    if (continueBtn) continueBtn.disabled = !hasSave;
    document.getElementById('save-status')?.classList.remove('save-warning');
    setText('save-status', hasSave ? '上次的牧场还在等你，继续照料吧。' : '还没有存档，从这个春天开始吧。');
    document.getElementById('app')!.dataset.playing = 'false';
  }
  hideTitle(): void { this.title.classList.add('hidden'); }

  showHud(): void { this.hud.classList.remove('hidden'); document.getElementById('app')!.dataset.playing = 'true'; this.updateHud(); }
  hideHud(): void { this.hud.classList.add('hidden'); }

  updateHud(): void {
    if (this.hud.classList.contains('hidden')) return;
    renderHud();
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
    const previousTitle = this.modalCard.querySelector('h2')?.textContent;
    if (previousTitle !== options.title) {
      this.toastRoot.querySelectorAll('.toast:not(.bad)').forEach(toast => toast.remove());
    }
    if (!this.isModalOpen()) this.previousFocus = document.activeElement as HTMLElement;
    if (this.isModalOpen()) this.closeModal(true);
    this.modalClosable = options.closable ?? true;
    this.modalOnClose = options.onClose ?? null;
    this.modalCard.innerHTML = `
      <div class="modal-head">
        <div><h2 id="modal-title">${options.title}</h2>${options.subtitle ? `<p>${options.subtitle}</p>` : ''}</div>
        ${this.modalClosable ? '<button class="modal-close" aria-label="关闭">×</button>' : ''}
      </div>
      <div class="modal-feedback"></div>
      <div class="modal-body">${options.body}</div>`;
    this.modalCard.querySelector('.modal-feedback')?.appendChild(this.toastRoot);
    this.modalRoot.classList.remove('hidden');
    this.hud.inert = true;
    this.title.inert = true;
    this.modalCard.scrollTop = 0;
    this.modalCard.focus({ preventScroll: true });
    this.modalCard.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal());
    return this.modalCard.querySelector('.modal-body') as HTMLElement;
  }

  closeModal(force = false): void {
    if (!this.isModalOpen()) return;
    if (!this.modalClosable && !force) return;
    this.modalRoot.classList.add('hidden');
    this.hud.inert = false;
    this.title.inert = false;
    this.toastHome.appendChild(this.toastRoot);
    this.modalCard.innerHTML = '';
    const callback = this.modalOnClose;
    this.modalOnClose = null;
    callback?.();
    if (!this.isModalOpen()) this.previousFocus?.focus({ preventScroll: true });
  }

  openSettings(): void {
    if (this.isBlocking()) return;
    openSettingsPanel(this);
  }

  private onModalKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { event.preventDefault(); this.closeModal(); }
    if (event.key === 'Tab') {
    const controls = Array.from(this.modalCard.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]'))
      .filter(control => control.tabIndex >= 0 && control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === this.modalCard)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === this.modalCard)) { event.preventDefault(); first.focus(); }
    }
    event.stopPropagation();
  };

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
