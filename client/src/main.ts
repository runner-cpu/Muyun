import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './config';
import { gameState } from './core/GameState';
import { saveSystem } from './systems/SaveSystem';
import { audio } from './systems/AudioManager';
import { ui } from './ui/instance';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { RanchScene } from './scenes/RanchScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  parent: 'game',
  backgroundColor: '#1e3528',
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH * RENDER_SCALE,
    height: GAME_HEIGHT * RENDER_SCALE,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, PreloadScene, TitleScene, RanchScene],
};

const game = new Phaser.Game(config);
ui.showLoading();

const gameParent = document.getElementById('game');
if (gameParent && 'ResizeObserver' in window) {
  const observer = new ResizeObserver(() => game.scale.refresh());
  observer.observe(gameParent);
}
window.addEventListener('orientationchange', () => {
  window.setTimeout(() => game.scale.refresh(), 120);
});

const persist = (): void => {
  if (game.scene.isActive('RanchScene')) saveSystem.saveOnExit(gameState.toData());
};
window.addEventListener('pagehide', persist);
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});

audio.setSettings(gameState.settings);
// Debug handles for smoke tests and future tooling.
(window as unknown as { __MUYUN__: Phaser.Game }).__MUYUN__ = game;
(window as unknown as { __MUYUN_STATE__: typeof gameState }).__MUYUN_STATE__ = gameState;
