import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#101726');
    this.scene.start('PreloadScene');
  }
}
