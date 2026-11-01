import Phaser from 'phaser';
import { bus } from '../core/emitter';
import { Joystick } from '../ui/joystick';

export class InputManager {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private joystick: Joystick | null = null;
  private interactQueued = false;
  private enabled = true;
  private button: HTMLButtonElement | null = null;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE', false) as Record<string, Phaser.Input.Keyboard.Key>;
    }
    const base = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    if (base && knob) this.joystick = new Joystick(base, knob);
    this.button = document.getElementById('btn-interact') as HTMLButtonElement | null;
    this.button?.addEventListener('click', this.queueInteract);
    window.addEventListener('keydown', this.onKeyDown);
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.joystick?.setEnabled(enabled);
    if (!enabled) {
      this.interactQueued = false;
      for (const key of Object.values(this.keys)) key.reset();
    }
  }

  getVector(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    const editing = document.activeElement?.closest('button, summary, a[href], input, select, textarea, [contenteditable="true"], [role="dialog"]');
    if (!editing) {
      if (this.keys.A?.isDown || this.keys.LEFT?.isDown) x -= 1;
      if (this.keys.D?.isDown || this.keys.RIGHT?.isDown) x += 1;
      if (this.keys.W?.isDown || this.keys.UP?.isDown) y -= 1;
      if (this.keys.S?.isDown || this.keys.DOWN?.isDown) y += 1;
    }
    if (this.joystick) {
      const v = this.joystick.getVector();
      x += v.x;
      y += v.y;
    }
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  consumeInteract(): boolean {
    if (!this.interactQueued) return false;
    this.interactQueued = false;
    return true;
  }

  destroy(): void {
    this.setEnabled(false);
    this.joystick?.destroy();
    this.joystick = null;
    window.removeEventListener('keydown', this.onKeyDown);
    this.button?.removeEventListener('click', this.queueInteract);
  }

  private queueInteract = (): void => {
    if (!this.enabled) return;
    this.interactQueued = true;
    bus.emit('input:interact');
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement)?.closest('button, summary, a[href], input, select, textarea, [contenteditable="true"], [role="dialog"]')) return;
    if (event.code === 'KeyE' || event.code === 'Space') {
      if (event.code === 'Space') event.preventDefault();
      this.queueInteract();
    }
  };
}
