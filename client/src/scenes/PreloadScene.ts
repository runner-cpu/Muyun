import Phaser from 'phaser';
import { ui } from '../ui/instance';
import { registerPlayerAnims } from '../entities/Player';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload(): void {
    ui.showLoading();
    ui.setLoading(0, '正在加载牧场...');
    this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: 16, frameHeight: 24 });
    for (let i = 0; i < 3; i++) this.load.image(`tree_${i}`, `assets/trees/tree_${i}.png`);

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
    this.time.delayedCall(180, () => this.scene.start('TitleScene'));
  }
}
