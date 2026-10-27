import type { TriggerDef } from '../types';

export class InteractionSystem {
  private triggers: TriggerDef[] = [];
  private nearest: TriggerDef | null = null;
  private enabled = true;
  private cooldownUntil = 0;
  private lastPromptId: string | null = null;

  constructor(
    private onPrompt: (trigger: TriggerDef | null) => void,
    private onTrigger: (trigger: TriggerDef) => void,
  ) {}

  setTriggers(triggers: TriggerDef[]): void {
    this.triggers = [...triggers];
    this.nearest = null;
    this.lastPromptId = null;
  }

  addTrigger(trigger: TriggerDef): void { this.triggers.push(trigger); }

  removeTrigger(id: string): void {
    this.triggers = this.triggers.filter((t) => t.id !== id);
    if (this.nearest?.id === id) {
      this.nearest = null;
      this.onPrompt(null);
      this.lastPromptId = null;
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.nearest = null;
      this.lastPromptId = null;
      this.onPrompt(null);
      return;
    }
    this.onPrompt(this.nearest);
  }

  update(x: number, y: number): void {
    if (!this.enabled) return;
    let best: TriggerDef | null = null;
    let bestDist = Infinity;
    for (const trigger of this.triggers) {
      const dx = trigger.x - x;
      const dy = trigger.y - y;
      const dist = dx * dx + dy * dy;
      const radius = trigger.radius || 30;
      if (dist <= radius * radius && dist < bestDist) {
        best = trigger;
        bestDist = dist;
      }
    }
    this.nearest = best;
    const id = best?.id ?? null;
    if (id !== this.lastPromptId) {
      this.lastPromptId = id;
      this.onPrompt(best);
    }
  }

  getNearest(): TriggerDef | null { return this.enabled ? this.nearest : null; }

  interact(): boolean {
    if (!this.enabled || !this.nearest) return false;
    if (performance.now() < this.cooldownUntil) return false;
    this.cooldownUntil = performance.now() + 300;
    this.onTrigger(this.nearest);
    return true;
  }
}
