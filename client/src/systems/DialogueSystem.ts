import { gameState } from '../core/GameState';
import type { DialogueScript } from '../types';
import dialoguesData from '../data/dialogues.json';
import type { DialogueBox } from '../ui/dialoguebox';
import { audio } from './AudioManager';

const scripts = dialoguesData as Record<string, DialogueScript>;

export class DialogueSystem {
  private active = false;

  constructor(private box: DialogueBox) {}

  isActive(): boolean { return this.active; }

  async say(speaker: string, text: string): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      await this.box.showLine(speaker, text, []);
    } finally {
      this.box.hide();
      this.active = false;
    }
  }

  async start(id: string): Promise<void> {
    if (this.active) return;
    const script = scripts[id];
    if (!script) {
      console.warn(`dialogue not found: ${id}`);
      return;
    }
    this.active = true;
    try {
      for (const line of script.lines) {
        const choice = await this.box.showLine(script.speaker, line.text, line.choices ?? []);
        audio.playSfx('blip');
        if (choice) {
          if (choice.flag) gameState.setFlag(choice.flag);
          await this.box.showLine(script.speaker, choice.reply, []);
          break;
        }
      }
    } finally {
      this.box.hide();
      this.active = false;
    }
  }
}
