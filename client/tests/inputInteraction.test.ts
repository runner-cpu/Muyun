import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { InputManager } from '../src/systems/InputManager';

afterEach(() => vi.unstubAllGlobals());

describe('原生互动按钮', () => {
  it('支持鼠标/触摸以及键盘产生的click，禁用和销毁后不响应', () => {
    const button = new EventTarget();
    vi.stubGlobal('document', { getElementById: (id: string) => id === 'btn-interact' ? button : null });
    vi.stubGlobal('window', new EventTarget());
    const input = new InputManager({ input: {} } as Phaser.Scene);
    button.dispatchEvent(new Event('click'));
    expect(input.consumeInteract()).toBe(true);
    expect(input.consumeInteract()).toBe(false);
    input.setEnabled(false);
    button.dispatchEvent(new Event('click'));
    expect(input.consumeInteract()).toBe(false);
    input.setEnabled(true);
    button.dispatchEvent(new Event('click'));
    expect(input.consumeInteract()).toBe(true);
    input.destroy();
    button.dispatchEvent(new Event('click'));
    expect(input.consumeInteract()).toBe(false);
  });

  it('聚焦summary时保留Space原生展开，不阻止默认行为或排入场景互动', () => {
    const keyboardTarget = new EventTarget();
    vi.stubGlobal('document', { getElementById: () => null });
    vi.stubGlobal('window', keyboardTarget);
    const input = new InputManager({ input: {} } as Phaser.Scene);
    const summary: { closest: (selector: string) => unknown } = {
      closest: selector => selector.includes('summary') ? summary : null,
    };
    const keydown = (target: unknown): Event => {
      const event = new Event('keydown', { cancelable: true });
      Object.defineProperties(event, { code: { value: 'Space' }, target: { value: target } });
      return event;
    };
    const summarySpace = keydown(summary);
    const prevented = vi.spyOn(summarySpace, 'preventDefault');
    keyboardTarget.dispatchEvent(summarySpace);
    expect(prevented).not.toHaveBeenCalled();
    expect(summarySpace.defaultPrevented).toBe(false);
    expect(input.consumeInteract()).toBe(false);

    // Check the handler is actually bound: Space on the scene still interacts.
    const sceneSpace = keydown({ closest: () => null });
    keyboardTarget.dispatchEvent(sceneSpace);
    expect(sceneSpace.defaultPrevented).toBe(true);
    expect(input.consumeInteract()).toBe(true);
    input.destroy();
  });
});
