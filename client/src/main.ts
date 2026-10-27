import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { gameState } from './core/GameState';
import { saveSystem } from './systems/SaveSystem';
import { audio } from './systems/AudioManager';
import { ui } from './ui/instance';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { CampusScene } from './scenes/CampusScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#101726',
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, PreloadScene, TitleScene, CampusScene],
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
  if (game.scene.isActive('CampusScene')) saveSystem.save(gameState.toData());
};
window.addEventListener('pagehide', persist);
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});

audio.setSettings(gameState.settings);
// Debug handle for smoke tests and future tooling.
(window as unknown as { __PIXEL_CAMPUS__: Phaser.Game }).__PIXEL_CAMPUS__ = game;
