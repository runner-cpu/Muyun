import Phaser from 'phaser';

export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, tint: number) {
    scene.add.ellipse(x, y + 9, 12, 4, 0x000000, 0.28).setDepth(8);
    this.sprite = scene.add.sprite(x, y, 'player', 0).setTint(tint).setDepth(10);
    this.label = scene.add.text(x, y - 22, name, {
      fontFamily: '"Microsoft YaHei", "PingFang SC", monospace',
      fontSize: '9px',
      color: '#f4ecd8',
      stroke: '#101726',
      strokeThickness: 3,
    }).setOrigin(0.5).setResolution(2).setDepth(20);
    scene.tweens.add({ targets: this.sprite, y: y - 1, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}
