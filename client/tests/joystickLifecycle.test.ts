import { describe, expect, it } from 'vitest';
import { Joystick } from '../src/ui/joystick';

class Base extends EventTarget {
  captures = new Set<number>();
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  setPointerCapture(id: number) { this.captures.add(id); }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  releasePointerCapture(id: number) { this.captures.delete(id); }
}
const down = () => Object.assign(new Event('pointerdown', { cancelable: true }), { pointerId: 1, clientX: 80, clientY: 50 });

describe('摇杆场景卸载', () => {
  it('移除旧控制器的监听并释放指针，新场景只由新控制器响应', () => {
    const base = new Base();
    const oldKnob = { style: { transform: '' } };
    const old = new Joystick(base as unknown as HTMLElement, oldKnob as HTMLElement);
    base.dispatchEvent(down());
    expect(old.getVector().x).toBeGreaterThan(0);
    expect(base.hasPointerCapture(1)).toBe(true);
    old.destroy();
    expect(old.getVector()).toEqual({ x: 0, y: 0 });
    expect(base.hasPointerCapture(1)).toBe(false);
    oldKnob.style.transform = 'unchanged';
    const next = new Joystick(base as unknown as HTMLElement, { style: {} } as HTMLElement);
    base.dispatchEvent(down());
    expect(next.getVector().x).toBeGreaterThan(0);
    expect(old.getVector()).toEqual({ x: 0, y: 0 });
    expect(oldKnob.style.transform).toBe('unchanged');
    next.destroy();
  });
});
