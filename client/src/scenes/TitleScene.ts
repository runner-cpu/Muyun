import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { gameState } from '../core/GameState';
import { saveSystem } from '../systems/SaveSystem';
import { audio } from '../systems/AudioManager';
import { ui } from '../ui/instance';

export class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create(): void {
    this.drawBackdrop();
    this.createMotes();
    ui.showTitle(saveSystem.exists());
    audio.setSettings(gameState.settings);

    ui.onNewGame = () => {
      audio.unlock();
      gameState.newGame();
      saveSystem.clear();
      this.startRanch();
    };
    ui.onContinue = () => {
      const save = saveSystem.load();
      if (!save) {
        ui.toast('没有找到存档，先开始新的一局吧', 'bad');
        return;
      }
      audio.unlock();
      gameState.load(save);
      this.startRanch();
    };
  }

  private startRanch(): void {
    ui.hideTitle();
    this.scene.start('RanchScene');
  }

  /** A cold-altitude dawn: banded sky, snow line, yurt, fence and herd silhouettes. */
  private drawBackdrop(): void {
    const g = this.add.graphics();
    const bands = ['#0d1526', '#142138', '#1d3150', '#2e5c8a', '#4f86ad', '#8fb4c4', '#c9bfa0', '#e0b978'];
    const bandH = Math.ceil(GAME_HEIGHT / bands.length);
    bands.forEach((color, i) => {
      g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1)
        .fillRect(0, i * bandH, GAME_WIDTH, bandH + 1);
    });

    // low sun
    g.fillStyle(0xf2d7a0, 0.10).fillCircle(372, 150, 40);
    g.fillStyle(0xf2d7a0, 0.18).fillCircle(372, 150, 26);
    g.fillStyle(0xfff3d6, 1).fillCircle(372, 150, 11);

    // snow mountains
    g.fillStyle(0x2b3f5c, 1);
    g.fillTriangle(-30, 196, 92, 96, 214, 196);
    g.fillTriangle(140, 196, 268, 74, 396, 196);
    g.fillTriangle(330, 196, 430, 118, 530, 196);
    g.fillStyle(0xdce8ee, 0.9);
    g.fillTriangle(92, 96, 74, 124, 110, 124);
    g.fillTriangle(268, 74, 244, 112, 292, 112);
    g.fillTriangle(430, 118, 414, 140, 446, 140);

    // mid ridge
    g.fillStyle(0x1e2c44, 1);
    g.fillRect(0, 194, GAME_WIDTH, 26);

    // pasture
    g.fillStyle(0x5c5c2e, 1);
    g.fillRect(0, 214, GAME_WIDTH, GAME_HEIGHT - 214);
    g.fillStyle(0x6d6a35, 1);
    for (let i = 0; i < 40; i++) {
      const x = (i * 37) % GAME_WIDTH;
      const y = 220 + ((i * 53) % 44);
      g.fillRect(x, y, 2, 1);
    }

    // yurt
    g.fillStyle(0x8a6a3a, 1).fillRect(96, 196, 54, 24);
    g.fillStyle(0xd8c9a8, 1).fillRect(96, 192, 54, 6);
    g.fillStyle(0xb59a6a, 1).fillTriangle(92, 192, 123, 170, 154, 192);
    g.fillStyle(0x4a3a24, 1).fillRect(117, 206, 10, 14);

    // fence
    g.fillStyle(0x3d2f1d, 1);
    for (let x = 8; x < GAME_WIDTH; x += 26) g.fillRect(x, 236, 3, 18);
    g.fillRect(0, 240, GAME_WIDTH, 2);
    g.fillRect(0, 248, GAME_WIDTH, 2);

    // herd silhouettes
    const herd: Array<[number, number, number]> = [[196, 232, 13], [228, 238, 11], [272, 230, 10], [300, 240, 12]];
    for (const [x, y, w] of herd) {
      g.fillStyle(0x14110e, 1);
      g.fillRect(x, y, w, w * 0.52);
      g.fillRect(x + w - 3, y - 3, 4, 5);
      g.fillRect(x + 2, y + w * 0.52, 2, 5);
      g.fillRect(x + w - 5, y + w * 0.52, 2, 5);
    }

    // foreground
    g.fillStyle(0x141a22, 1).fillRect(0, 258, GAME_WIDTH, 12);
  }

  private createMotes(): void {
    for (let i = 0; i < 16; i++) {
      const x = Phaser.Math.Between(40, 460);
      const y = Phaser.Math.Between(40, 240);
      const rect = this.add.rectangle(x, y, 2, 2, 0xf2d7a0, Phaser.Math.FloatBetween(0.12, 0.5));
      this.tweens.add({
        targets: rect,
        y: y - Phaser.Math.Between(16, 46),
        alpha: 0,
        duration: Phaser.Math.Between(2600, 5400),
        delay: Phaser.Math.Between(0, 2000),
        repeat: -1,
        onRepeat: () => { rect.y = y; rect.alpha = Phaser.Math.FloatBetween(0.12, 0.5); },
      });
    }
  }
}
