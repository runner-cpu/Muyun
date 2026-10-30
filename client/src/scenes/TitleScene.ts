import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config';
import { gameState } from '../core/GameState';
import { saveSystem } from '../systems/SaveSystem';
import { audio } from '../systems/AudioManager';
import { ui } from '../ui/instance';

export class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  preload(): void {
    if (!this.textures.exists('plateau-title')) {
      this.load.image('plateau-title', 'assets/art/plateau-title.webp');
    }
  }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.drawBackdrop();
    this.createMotes();
    saveSystem.setMode('year');
    const save = saveSystem.load('year');
    if (save) gameState.setSettings(save.settings);
    ui.showTitle(Boolean(save));
    const winter = saveSystem.load('winter-challenge-v1');
    const winterContinue = document.getElementById('btn-continue-winter') as HTMLButtonElement | null;
    if (winterContinue) winterContinue.disabled = !winter;
    audio.setSettings(gameState.settings);

    ui.onNewGame = () => {
      audio.unlock();
      const settings = { ...gameState.settings };
      gameState.newGame();
      gameState.setSettings(settings);
      saveSystem.setMode('year');
      saveSystem.clear('year');
      this.startRanch();
    };
    ui.onContinue = () => {
      const save = saveSystem.load('year');
      if (!save) {
        ui.toast('没有找到存档，先开始新的一局吧', 'bad');
        return;
      }
      audio.unlock();
      saveSystem.setMode('year');
      gameState.load(save);
      this.startRanch();
    };
    ui.onWinterChallenge = () => {
      const begin = (): void => {
        audio.unlock();
        const settings = { ...gameState.settings };
        gameState.newGame(undefined, 'winter-challenge-v1');
        gameState.setSettings(settings);
        saveSystem.setMode('winter-challenge-v1');
        saveSystem.save(gameState.toData());
        ui.closeModal();
        this.startRanch();
      };
      const el = ui.openModal({ title: '四周越冬挑战', subtitle: '固定初始条件，试出自己的经营方案。', body: `
        <p>从第 10 周开始，照料 12 头牦牛与 18 只羊，走过四次周结算。</p>
        <dl class="overview-ledger"><div><dt>可用现金</dt><dd>¥6,000</dd></div><div><dt>干草</dt><dd>2,200 kg</dd></div><div><dt>预设设备</dt><dd>草场监测 + 10 个项圈</dd></div><div><dt>每周行动</dt><dd>3 点</dd></div></dl>
        <p class="modal-note">设备已安装，现金不再扣购置费；每周收取人工与设备维护。挑战使用独立存档。${winter ? '开始将替换已有挑战进度，可关闭并选择继续挑战。' : ''}</p>
        <div class="modal-actions"><button class="pixel-btn primary" id="challenge-start">开始越冬</button></div>` });
      el.querySelector('#challenge-start')?.addEventListener('click', begin);
    };
    ui.onContinueWinter = () => {
      const saved = saveSystem.load('winter-challenge-v1');
      if (!saved) { ui.toast('没有找到挑战存档，可以开始一次越冬挑战。', 'bad'); return; }
      audio.unlock();
      saveSystem.setMode('winter-challenge-v1');
      gameState.load(saved);
      this.startRanch();
    };
    ui.onReturnTitle = () => {
      ui.closeModal(true);
      ui.hideHud();
      this.scene.get('RanchScene').scene.stop();
      this.scene.start('TitleScene');
    };
  }

  private startRanch(): void {
    ui.hideTitle();
    this.scene.start('RanchScene');
  }

  /** A cold-altitude dawn: banded sky, snow line, yurt, fence and herd silhouettes. */
  private drawBackdrop(): void {
    if (this.textures.exists('plateau-title')) {
      const art = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'plateau-title');
      const scale = Math.max(GAME_WIDTH / art.width, GAME_HEIGHT / art.height);
      art.setScale(scale);
      return;
    }

    // A network or asset failure still leaves a playable title screen.
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < 7; i++) {
      const x = Phaser.Math.Between(220, 460);
      const y = Phaser.Math.Between(120, 240);
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
