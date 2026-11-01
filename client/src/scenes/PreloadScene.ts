import Phaser from 'phaser';
import { ui } from '../ui/instance';
import { registerPlayerAnims } from '../entities/Player';
import { registerAnimalAnims } from '../entities/Animal';

/** Bump when art files change so browsers never serve a stale sheet. */
const V = '?v=6';

export class PreloadScene extends Phaser.Scene {
  private failed = new Set<string>();
  constructor() { super('PreloadScene'); }

  preload(): void {
    this.failed.clear();
    ui.showLoading();
    ui.setLoading(0, '正在加载牧场...');
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      this.load.image(`ranch-tiles-${season}`, `assets/tilesets/ranch-tiles-${season}.png${V}`);
    }
    this.load.spritesheet('player', `assets/sprites/herder-detailed.png${V}`, { frameWidth: 48, frameHeight: 64 });
    this.load.spritesheet('yak', `assets/sprites/yak-detailed.png${V}`, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('sheep', `assets/sprites/sheep-detailed.png${V}`, { frameWidth: 64, frameHeight: 64 });
    this.load.image('barn', `assets/structures/barn.png${V}`);
    this.load.image('sign', `assets/structures/sign.png${V}`);
    this.load.image('well', `assets/structures/well.png${V}`);
    this.load.image('woodpile', `assets/structures/woodpile.png${V}`);
    this.load.image('cart', `assets/structures/cart.png${V}`);
    this.load.image('laundry', `assets/structures/laundry.png${V}`);
    for (let i = 0; i < 3; i++) this.load.image(`tree_${i}`, `assets/trees/tree_${i}.png${V}`);

    this.load.on('progress', (value: number) => {
      if (this.failed.size) return;
      ui.setLoading(value, value < 1 ? '正在加载牧场...' : '赶牛出圈...');
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.failed.add(file.key);
      ui.showLoadingFailure(this.failed.size);
    });
  }

  create(): void {
    if (this.failed.size) { ui.showLoadingFailure(this.failed.size); return; }
    registerPlayerAnims(this);
    registerAnimalAnims(this);
    this.time.delayedCall(180, () => this.scene.start('TitleScene'));
  }
}
