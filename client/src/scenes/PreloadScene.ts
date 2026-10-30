import Phaser from 'phaser';
import { ui } from '../ui/instance';
import { registerPlayerAnims } from '../entities/Player';
import { registerAnimalAnims } from '../entities/Animal';

/** Bump when art files change so browsers never serve a stale sheet. */
const V = '?v=5';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload(): void {
    ui.showLoading();
    ui.setLoading(0, '正在加载牧场...');
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      this.load.image(`ranch-tiles-${season}`, `assets/tilesets/ranch-tiles-${season}.png${V}`);
    }
    this.load.spritesheet('player', `assets/sprites/player.png${V}`, { frameWidth: 24, frameHeight: 32 });
    this.load.spritesheet('yak', `assets/sprites/yak.png${V}`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('sheep', `assets/sprites/sheep.png${V}`, { frameWidth: 32, frameHeight: 32 });
    this.load.image('barn', `assets/structures/barn.png${V}`);
    this.load.image('sign', `assets/structures/sign.png${V}`);
    this.load.image('well', `assets/structures/well.png${V}`);
    this.load.image('woodpile', `assets/structures/woodpile.png${V}`);
    this.load.image('cart', `assets/structures/cart.png${V}`);
    this.load.image('laundry', `assets/structures/laundry.png${V}`);
    for (let i = 0; i < 3; i++) this.load.image(`tree_${i}`, `assets/trees/tree_${i}.png${V}`);

    this.load.on('progress', (value: number) => {
      ui.setLoading(value, value < 1 ? '正在加载牧场...' : '赶牛出圈...');
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error('load error', file.src);
      ui.setLoading(1, `资源加载失败：${file.src}`);
    });
  }

  create(): void {
    registerPlayerAnims(this);
    registerAnimalAnims(this);
    this.time.delayedCall(180, () => this.scene.start('TitleScene'));
  }
}
