import { gameState } from '../core/GameState';
import type { DialogueScript } from '../types';
import type { DialogueBox } from '../ui/dialoguebox';
import { audio } from './AudioManager';

/**
 * Dialogue is data-driven: the ranch interaction controller injects the
 * script table at boot, so content changes never touch this file.
 */
export class DialogueSystem {
  private active = false;
  private scripts: Record<string, DialogueScript> = {};

  constructor(private box: DialogueBox) {}

  setScripts(scripts: Record<string, DialogueScript>): void {
    this.scripts = scripts;
  }

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
    const script = this.scripts[id];
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
