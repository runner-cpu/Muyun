import Phaser from 'phaser';

const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
const KINDS = ['yak', 'sheep'] as const;

export function registerAnimalAnims(scene: Phaser.Scene): void {
  for (const kind of KINDS) {
    DIRECTIONS.forEach((direction, row) => {
      const key = `${kind}-${direction}`;
      if (scene.anims.exists(key)) return;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(kind, { start: row * 2, end: row * 2 + 1 }),
        frameRate: 3,
        repeat: -1,
      });
    });
  }
}

/** A grazing animal: two-frame idle plus a slow drift inside its paddock. */
export class HerdSprite {
  readonly sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: 'yak' | 'sheep') {
    this.sprite = scene.add.sprite(x, y, kind, 0).setDepth(10 + y / 10000);
    this.sprite.play(`${kind}-down`);

    scene.tweens.add({
      targets: this.sprite,
      x: x + Phaser.Math.Between(-26, 26),
      y: y + Phaser.Math.Between(-14, 14),
      duration: Phaser.Math.Between(2800, 5600),
      delay: Phaser.Math.Between(0, 1800),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }
}
