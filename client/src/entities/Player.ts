import Phaser from 'phaser';
import { PLAYER_SPEED } from '../config';
import type { Direction } from '../types';

const ROWS: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private facing: Direction = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.shadow = scene.add.ellipse(x, y + 14, 14, 5, 0x000000, 0.3).setDepth(8);
    this.sprite = scene.physics.add.sprite(x, y, 'player', 0).setDisplaySize(24, 32).setDepth(10);
    this.sprite.setSize(24, 20).setOffset(12, 42);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDrag(900, 900);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.shadow.setPosition(x, y + 14);
  }

  update(vector: { x: number; y: number }): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const moving = Math.hypot(vector.x, vector.y) > 0.05;
    if (!moving) {
      body.setVelocity(0, 0);
      this.sprite.anims.stop();
      this.sprite.setFrame(ROWS[this.facing] * 4);
    } else {
      body.setVelocity(vector.x * PLAYER_SPEED, vector.y * PLAYER_SPEED);
      if (Math.abs(vector.x) > Math.abs(vector.y)) this.facing = vector.x < 0 ? 'left' : 'right';
      else this.facing = vector.y < 0 ? 'up' : 'down';
      this.sprite.play(`walk-${this.facing}`, true);
    }
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 14);
    this.shadow.setDepth(8);
    this.sprite.setDepth(10 + this.sprite.y / 10000);
  }

  stop(): void {
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.sprite.anims.stop();
    this.sprite.setFrame(ROWS[this.facing] * 4);
  }
}

export function registerPlayerAnims(scene: Phaser.Scene): void {
  const dirs: Direction[] = ['down', 'left', 'right', 'up'];
  dirs.forEach((dir, row) => {
    if (scene.anims.exists(`walk-${dir}`)) return;
    scene.anims.create({
      key: `walk-${dir}`,
      frames: scene.anims.generateFrameNumbers('player', { start: row * 4, end: row * 4 + 3 }),
      frameRate: 8,
      repeat: -1,
    });
  });
}
