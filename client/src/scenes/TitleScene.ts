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
      this.startCampus();
    };
    ui.onContinue = () => {
      const save = saveSystem.load();
      if (!save) {
        ui.toast('没有找到存档，先开始新的一天吧', 'bad');
        return;
      }
      audio.unlock();
      gameState.load(save);
      this.startCampus();
    };
  }

  private startCampus(): void {
    ui.hideTitle();
    this.scene.start('CampusScene');
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    const bands = ['#101726', '#17243d', '#253957', '#3d4e6b', '#6b596d', '#a86b62', '#d98a55', '#e8a15f'];
    const bandH = Math.ceil(GAME_HEIGHT / bands.length);
    bands.forEach((color, i) => g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1).fillRect(0, i * bandH, GAME_WIDTH, bandH + 1));
    // sun
    g.fillStyle(0xf2c14e, 0.1).fillCircle(386, 92, 34);
    g.fillStyle(0xf2c14e, 0.22).fillCircle(386, 92, 24);
    g.fillStyle(0xffe9a8, 1).fillCircle(386, 92, 13);
    // clouds
    g.fillStyle(0xf4ecd8, 0.16);
    for (const [x, y, w] of [[60, 48, 46], [104, 38, 26], [300, 54, 38], [420, 40, 22]]) {
      g.fillRect(x, y, w, 5);
      g.fillRect(x + 6, y - 4, w - 14, 4);
    }
    // distant hills
    g.fillStyle(0x2f3a52, 1);
    g.fillTriangle(0, 205, 90, 132, 190, 205);
    g.fillTriangle(130, 205, 250, 120, 380, 205);
    g.fillTriangle(300, 205, 400, 145, 480, 205);
    // campus silhouette
    g.fillStyle(0x1b2437, 1);
    g.fillRect(0, 208, 480, 62);
    const buildings = [[24, 178, 46, 32], [86, 166, 58, 44], [156, 186, 40, 24], [206, 156, 70, 54], [296, 182, 36, 28], [342, 168, 52, 42], [410, 184, 44, 26]];
    for (const [x, y, w, h] of buildings) {
      g.fillRect(x, y, w, h);
      g.fillStyle(0xf2c14e, 0.55);
      for (let wx = x + 5; wx < x + w - 4; wx += 9) for (let wy = y + 6; wy < y + h - 6; wy += 10) g.fillRect(wx, wy, 3, 4);
      g.fillStyle(0x1b2437, 1);
    }
    // gate
    g.fillStyle(0x0d1320, 1).fillRect(214, 186, 8, 24).fillRect(258, 186, 8, 24);
    g.fillRect(208, 180, 64, 7);
    // foreground path
    g.fillStyle(0x2f3a52, 1).fillRect(0, 250, 480, 20);
    g.fillStyle(0x4a4a55, 1).fillRect(210, 250, 60, 20);
    // trees
    for (const [x, y, s] of [[14, 230, 20], [66, 236, 14], [320, 230, 18], [450, 234, 16]]) {
      g.fillStyle(0x513720, 1).fillRect(x, y + s * 0.4, 4, s * 0.6);
      g.fillStyle(0x2e5e2e, 1).fillCircle(x + 2, y + s * 0.3, s * 0.5);
      g.fillStyle(0x3f7d3c, 1).fillCircle(x, y + s * 0.25, s * 0.4);
    }
  }

  private createMotes(): void {
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(240, 470);
      const y = Phaser.Math.Between(30, 250);
      const rect = this.add.rectangle(x, y, 2, 2, 0xf2c14e, Phaser.Math.FloatBetween(0.15, 0.6));
      this.tweens.add({
        targets: rect,
        y: y - Phaser.Math.Between(18, 50),
        alpha: 0,
        duration: Phaser.Math.Between(2400, 5200),
        delay: Phaser.Math.Between(0, 2000),
        repeat: -1,
        onRepeat: () => { rect.y = y; rect.alpha = Phaser.Math.FloatBetween(0.15, 0.6); },
      });
    }
  }
}
