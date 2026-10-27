import type { DialogueChoice } from '../types';

const TYPE_INTERVAL = 24;

export class DialogueBox {
  private root = document.getElementById('dialogue')!;
  private speakerEl = document.getElementById('dialogue-speaker')!;
  private textEl = document.getElementById('dialogue-text')!;
  private choicesEl = document.getElementById('dialogue-choices')!;
  private typingTimer: number | null = null;
  private fullText = '';
  private shown = 0;
  private typing = false;
  private resolveLine: (() => void) | null = null;
  private resolveChoice: ((choice: DialogueChoice | null) => void) | null = null;
  private choices: DialogueChoice[] = [];
  private onOpenChange: ((open: boolean) => void) | null = null;

  constructor() {
    this.root.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('#dialogue-choices')) return;
      this.advance();
    });
    window.addEventListener('keydown', this.onKeyDown);
  }

  setOpenCallback(callback: (open: boolean) => void): void { this.onOpenChange = callback; }

  isOpen(): boolean { return !this.root.classList.contains('hidden'); }

  async showLine(speaker: string, text: string, choices: DialogueChoice[] = []): Promise<DialogueChoice | null> {
    this.root.classList.remove('hidden');
    this.onOpenChange?.(true);
    this.speakerEl.textContent = speaker;
    this.choicesEl.innerHTML = '';
    this.choices = choices;
    this.fullText = text;
    this.shown = 0;
    this.textEl.textContent = '';
    this.typing = true;
    this.startTyping();
    const choice = await new Promise<DialogueChoice | null>((resolve) => {
      this.resolveChoice = resolve;
      this.resolveLine = () => {
        if (choices.length === 0) resolve(null);
      };
    });
    this.stopTyping();
    return choice;
  }

  hide(): void {
    this.stopTyping();
    this.root.classList.add('hidden');
    this.choicesEl.innerHTML = '';
    this.resolveLine = null;
    this.resolveChoice = null;
    this.onOpenChange?.(false);
  }

  private startTyping(): void {
    this.stopTyping();
    this.typingTimer = window.setInterval(() => {
      this.shown += 1;
      this.textEl.textContent = this.fullText.slice(0, this.shown);
      if (this.shown >= this.fullText.length) this.finishTyping();
    }, TYPE_INTERVAL);
  }

  private finishTyping(): void {
    this.stopTyping();
    this.textEl.textContent = this.fullText;
    this.typing = false;
    if (this.choices.length > 0) this.renderChoices();
  }

  private stopTyping(): void {
    if (this.typingTimer !== null) window.clearInterval(this.typingTimer);
    this.typingTimer = null;
  }

  private renderChoices(): void {
    this.choicesEl.innerHTML = '';
    for (const choice of this.choices) {
      const btn = document.createElement('button');
      btn.className = 'pixel-btn';
      btn.textContent = choice.text;
      btn.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.choicesEl.innerHTML = '';
        this.resolveChoice?.(choice);
        this.resolveChoice = null;
        this.resolveLine = null;
      });
      this.choicesEl.appendChild(btn);
    }
  }

  private advance(): void {
    if (this.typing) {
      this.finishTyping();
      return;
    }
    if (this.choices.length > 0) return;
    this.resolveLine?.();
    this.resolveLine = null;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen()) return;
    if (event.code !== 'KeyE' && event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    this.advance();
  };
}
