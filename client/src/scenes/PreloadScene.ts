import Phaser from 'phaser';
import { ui } from '../ui/instance';
import { registerPlayerAnims } from '../entities/Player';
import { registerCatAnims } from '../entities/Cat';

export class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload(): void {
    ui.showLoading();
    ui.setLoading(0, '正在加载校园...');
    this.load.image('tiles', 'assets/tilesets/campus-tiles.png');
    this.load.tilemapTiledJSON('campus', 'assets/maps/campus.tmj');
    this.load.spritesheet('player', 'assets/sprites/player.png', { frameWidth: 16, frameHeight: 24 });
    this.load.spritesheet('cats', 'assets/sprites/cats.png', { frameWidth: 16, frameHeight: 16 });

    this.load.on('progress', (value: number) => {
      ui.setLoading(value, value < 1 ? '正在加载校园...' : '整理书包...');
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error('load error', file.src);
      ui.setLoading(1, `资源加载失败：${file.src}`);
    });
  }

  create(): void {
    registerPlayerAnims(this);
    registerCatAnims(this);
    this.time.delayedCall(220, () => this.scene.start('TitleScene'));
  }
}
