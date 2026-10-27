import Phaser from 'phaser';
import type { CatDef } from '../types';

export class Cat {
  readonly sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, cat: CatDef) {
    scene.add.ellipse(x, y + 6, 10, 3, 0x000000, 0.25).setDepth(8);
    this.sprite = scene.add.sprite(x, y, 'cats', cat.variant * 2).setDepth(10);
    this.sprite.play(`cat-idle-${cat.variant}`);
  }
}

export function registerCatAnims(scene: Phaser.Scene, catCount = 5): void {
  for (let variant = 0; variant < catCount; variant++) {
    if (scene.anims.exists(`cat-idle-${variant}`)) continue;
    scene.anims.create({
      key: `cat-idle-${variant}`,
      frames: scene.anims.generateFrameNumbers('cats', { start: variant * 2, end: variant * 2 + 1 }),
      frameRate: 2,
      repeat: -1,
    });
  }
}
