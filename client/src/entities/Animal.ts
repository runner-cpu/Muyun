import Phaser from 'phaser';
import type { Animal } from '../sim/types';

const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
const KINDS = ['yak', 'sheep'] as const;

export function registerAnimalAnims(scene: Phaser.Scene): void {
  for (const kind of KINDS) {
    DIRECTIONS.forEach((direction, row) => {
      const key = `${kind}-${direction}`;
      if (scene.anims.exists(key)) return;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(kind, { start: row * 4, end: row * 4 + 3 }),
        frameRate: 4,
        repeat: -1,
      });
    });
  }
}

/** A grazing animal alternates short walks with a pause near its home. */
export class HerdSprite {
  readonly sprite: Phaser.GameObjects.Sprite;
  private markers: Phaser.GameObjects.Graphics;
  private animal: Animal;
  private facing: typeof DIRECTIONS[number];
  private hovered = false;

  constructor(scene: Phaser.Scene, x: number, y: number, animal: Animal, select: (id: string) => void) {
    this.animal = animal;
    const kind = animal.species;
    const initialRow = [...animal.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % DIRECTIONS.length;
    this.facing = DIRECTIONS[initialRow];
    this.sprite = scene.add.sprite(x, y, kind, initialRow * 4)
      .setDisplaySize(32, 32).setDepth(10 + y / 10000)
      .setName(`animal-${animal.id}`).setInteractive({ useHandCursor: true });
    this.markers = scene.add.graphics();
    this.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Phaser also receives window events over the DOM HUD at stale world coordinates.
      if (pointer.downElement === scene.game.canvas) select(this.animal.id);
    });
    this.sprite.on('pointerover', () => { this.hovered = true; this.drawMarkers(); });
    this.sprite.on('pointerout', () => { this.hovered = false; this.drawMarkers(); });
    this.updateAnimal(animal);

    let timer: Phaser.Time.TimerEvent | undefined;
    this.sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
      timer?.remove(false);
      scene.tweens.killTweensOf(this.sprite);
      this.markers.destroy();
    });

    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const scheduleWalk = (delay: number): void => {
      timer = scene.time.delayedCall(delay, () => {
        if (!this.sprite.active) return;
        const targetX = x + Phaser.Math.Between(-8, 8);
        const targetY = y + Phaser.Math.Between(-5, 5);
        const dx = targetX - this.sprite.x;
        const dy = targetY - this.sprite.y;
        const direction = Math.abs(dx) > Math.abs(dy)
          ? (dx < 0 ? 'left' : 'right')
          : (dy < 0 ? 'up' : 'down');
        const row = DIRECTIONS.indexOf(direction);

        this.facing = direction;
        this.drawMarkers();
        this.sprite.play(`${kind}-${direction}`);
        scene.tweens.add({
          targets: this.sprite,
          x: targetX,
          y: targetY,
          duration: Phaser.Math.Between(3000, 6000),
          ease: 'Sine.inOut',
          onUpdate: () => {
            this.sprite.setDepth(10 + this.sprite.y / 10000);
            this.positionMarkers();
          },
          onComplete: () => {
            if (!this.sprite.active) return;
            this.sprite.anims.stop();
            this.sprite.setFrame(row * 4);
            scheduleWalk(Phaser.Math.Between(2000, 4500));
          },
        });
      });
    };

    scheduleWalk(Phaser.Math.Between(1000, 4000));
  }

  updateAnimal(animal: Animal): void {
    this.animal = animal;
    this.sprite.setData({ animalId: animal.id, health: animal.health, collar: animal.collar, bcs: animal.bcs });
    this.drawMarkers();
  }

  private positionMarkers(): void {
    this.markers.setPosition(this.sprite.x, this.sprite.y).setDepth(this.sprite.depth + 0.00001);
  }

  private drawMarkers(): void {
    this.markers.clear();
    if (this.hovered) this.markers.lineStyle(1, 0xf1dfac).strokeRect(-15, -14, 30, 29);
    if (this.animal.collar) {
      this.markers.fillStyle(0x7dd8d1);
      if (this.facing === 'left') this.markers.fillRect(-10, -3, 2, 6);
      else if (this.facing === 'right') this.markers.fillRect(8, -3, 2, 6);
      else this.markers.fillRect(-4, this.facing === 'up' ? -7 : 3, 8, 2);
    }
    if (this.animal.health === 'sick') {
      this.markers.fillStyle(0x2b2924).fillPoints([{ x: 0, y: -21 }, { x: 5, y: -16 }, { x: 0, y: -11 }, { x: -5, y: -16 }], true);
      this.markers.fillStyle(0xf58b77).fillPoints([{ x: 0, y: -20 }, { x: 4, y: -16 }, { x: 0, y: -12 }, { x: -4, y: -16 }], true);
      this.markers.fillStyle(0x3d2c23).fillRect(-1, -18, 2, 3).fillRect(-1, -14, 2, 1);
    } else if (this.animal.bcs < 2.5 || this.animal.health === 'subclinical') {
      this.markers.fillStyle(0xe8c279).fillTriangle(0, -20, 5, -12, -5, -12);
      this.markers.fillStyle(0x3d2c23).fillRect(0, -17, 1, 3);
    }
    this.positionMarkers();
  }
}
