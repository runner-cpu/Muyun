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
});
