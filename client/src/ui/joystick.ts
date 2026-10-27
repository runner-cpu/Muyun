export class Joystick {
  private pointerId: number | null = null;
  private vector = { x: 0, y: 0 };
  private enabled = true;

  constructor(private base: HTMLElement, private knob: HTMLElement) {
    this.base.addEventListener('pointerdown', this.onDown);
    this.base.addEventListener('pointermove', this.onMove);
    this.base.addEventListener('pointerup', this.onUp);
    this.base.addEventListener('pointercancel', this.onUp);
    this.base.addEventListener('lostpointercapture', this.onUp);
  }

  getVector(): { x: number; y: number } { return { ...this.vector }; }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  private onDown = (event: PointerEvent): void => {
    if (!this.enabled) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.base.setPointerCapture(event.pointerId);
    this.update(event);
  };

  private onMove = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) return;
    event.preventDefault();
    this.update(event);
  };

  private onUp = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) return;
    this.reset();
  };

  private update(event: PointerEvent): void {
    const rect = this.base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const max = rect.width * 0.32;
    const length = Math.hypot(dx, dy);
    const scale = length > max ? max / length : 1;
    const x = dx * scale;
    const y = dy * scale;
    this.knob.style.transform = `translate(${x}px, ${y}px)`;
    const dead = rect.width * 0.08;
    const normalized = Math.hypot(x, y) < dead ? 0 : Math.min(1, Math.hypot(x, y) / max);
    const angle = Math.atan2(y, x);
    this.vector = normalized === 0 ? { x: 0, y: 0 } : { x: Math.cos(angle) * normalized, y: Math.sin(angle) * normalized };
  }

  private reset(): void {
    this.pointerId = null;
    this.vector = { x: 0, y: 0 };
    this.knob.style.transform = 'translate(0px, 0px)';
  }
}
