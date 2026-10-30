import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { HerdSprite } from '../src/entities/Animal';
import { createAnimal } from '../src/sim/animal';

vi.mock('phaser', () => ({ default: {
  GameObjects: { Events: { DESTROY: 'destroy' } },
  Math: { Between: () => 0 },
} }));

function animalInput() {
  const handlers = new Map<string, (pointer: unknown) => void>();
  const sprite = {
    x: 150, y: 200, depth: 10, active: true,
    setDisplaySize: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setName: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, listener: (pointer: unknown) => void) => { handlers.set(event, listener); }),
    once: vi.fn(),
  };
  const graphics = {
    clear: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
  };
  const canvas = { nodeName: 'CANVAS' };
  const scene = {
    game: { canvas },
    add: { sprite: () => sprite, graphics: () => graphics },
    time: { delayedCall: vi.fn() },
  };
  const select = vi.fn();
  new HerdSprite(scene as unknown as Phaser.Scene, sprite.x, sprite.y,
    createAnimal({ id: 'yak-5', tag: 'B-005', species: 'yak', sex: 'female', ageWeeks: 104 }), select);
  return { canvas, select, pointerDown: handlers.get('pointerdown')! };
}

describe('ranch animal pointer source', () => {
  it.each(['mousedown', 'touchstart'])('ignores a HUD %s hit reported at stale animal coordinates', type => {
    const { select, pointerDown } = animalInput();
    const overviewButton = { nodeName: 'BUTTON', id: 'overview-button' };
    pointerDown({ downElement: overviewButton, x: 150, y: 200, event: { type, target: overviewButton } });
    expect(select).not.toHaveBeenCalled();
  });

  it.each(['mousedown', 'touchstart'])('opens the animal when %s starts on the game canvas', type => {
    const { canvas, select, pointerDown } = animalInput();
    pointerDown({ downElement: canvas, x: 150, y: 200, event: { type, target: canvas } });
    expect(select).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledWith('yak-5');
  });

  it('ignores a pointer without a recorded down element', () => {
    const { select, pointerDown } = animalInput();
    pointerDown({ downElement: null, x: 150, y: 200 });
    expect(select).not.toHaveBeenCalled();
  });
});
