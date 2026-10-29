import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TILE, WORLD_TILES_H, WORLD_TILES_W } from '../config';
import { gameState } from '../core/GameState';
import { bus } from '../core/emitter';
import { Player } from '../entities/Player';
import { InputManager } from '../systems/InputManager';
import { InteractionSystem } from '../systems/InteractionSystem';
import { RanchInteractionController } from '../systems/RanchInteractionController';
import { tintForSeason } from '../systems/Calendar';
import { audio } from '../systems/AudioManager';
import { ui } from '../ui/instance';
import type { TriggerDef } from '../types';

const TREE_SPOTS: Array<[number, number, number]> = [
  [24, 40, 0], [70, 28, 1], [128, 52, 2], [196, 30, 0],
  [420, 44, 2], [492, 28, 1], [560, 56, 0], [604, 92, 2],
  [22, 300, 1], [64, 360, 0], [116, 420, 2], [520, 350, 1],
  [576, 404, 0], [612, 300, 2],
];

export class RanchScene extends Phaser.Scene {
  private player!: Player;
  private controls!: InputManager;
  private interactions!: InteractionSystem;
  private controller!: RanchInteractionController;
  private wash!: Phaser.GameObjects.Rectangle;
  private unsubscribes: Array<() => void> = [];

  constructor() { super('RanchScene'); }

  create(): void {
    const worldW = WORLD_TILES_W * TILE;
    const worldH = WORLD_TILES_H * TILE;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor('#1b3a5c');

    this.buildGround(worldW, worldH);
    this.buildTrees();

    const spawn = gameState.getSpawn();
    this.player = new Player(this, spawn.x, spawn.y);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    this.controller = new RanchInteractionController(this);
    this.interactions = new InteractionSystem(
      (trigger) => {
        if (trigger) ui.showPrompt(trigger.label);
        else ui.hidePrompt();
      },
      (trigger) => { void this.controller.handle(trigger); },
    );
    this.interactions.setTriggers(this.buildTriggers());

    this.controls = new InputManager(this);

    this.wash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.applySeasonWash();

    this.unsubscribes.push(bus.on('state:changed', () => this.applySeasonWash()));
    this.unsubscribes.push(bus.on('calendar:changed', () => this.applySeasonWash()));

    ui.showHud();
    audio.setSeason(gameState.season);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  update(): void {
    const blocked = ui.isBlocking();
    this.interactions.setEnabled(!blocked);

    if (blocked) {
      this.player.stop();
    } else {
      this.player.update(this.controls.getVector());
      this.interactions.update(this.player.x, this.player.y);
      if (this.controls.consumeInteract()) this.interactions.interact();
    }

    gameState.setPlayer(this.player.x, this.player.y);
  }

  private teardown(): void {
    for (const off of this.unsubscribes) off();
    this.unsubscribes = [];
    this.controls.destroy();
    ui.hidePrompt();
  }

  private applySeasonWash(): void {
    const tint = tintForSeason(gameState.season);
    this.wash.setFillStyle(tint.color, tint.alpha);
  }

  /** Placeholder art until the Tiled ranch map lands in Phase 2. */
  private buildGround(worldW: number, worldH: number): void {
    if (!this.textures.exists('ranch-grass')) {
      const g = this.add.graphics();
      g.fillStyle(0x77743a, 1).fillRect(0, 0, 16, 16);
      g.fillStyle(0x827e40, 1);
      for (const [x, y] of [[2, 3], [7, 2], [12, 5], [4, 10], [9, 12], [14, 13], [6, 6], [1, 14]]) {
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle(0x8f8a46, 1);
      for (const [x, y] of [[3, 4], [10, 3], [13, 9], [5, 13]]) g.fillRect(x, y, 1, 1);
      g.generateTexture('ranch-grass', 16, 16);
      g.destroy();
    }
    this.add.tileSprite(0, 0, worldW, worldH, 'ranch-grass').setOrigin(0, 0).setDepth(0);

    const art = this.add.graphics().setDepth(1);
    // dirt track
    art.fillStyle(0x6b5a3a, 1).fillRect(304, 0, 32, worldH);
    art.fillStyle(0x7a6844, 1);
    for (let y = 4; y < worldH; y += 11) art.fillRect(310 + ((y * 7) % 18), y, 4, 2);

    // paddocks
    const paddocks: Array<[number, number, number, number]> = [
      [32, 72, 240, 152], [352, 72, 240, 152],
      [32, 256, 240, 152], [352, 256, 240, 152],
    ];
    art.lineStyle(2, 0x5b4526, 1);
    for (const [x, y, w, h] of paddocks) {
      art.strokeRect(x, y, w, h);
      art.fillStyle(0x5b4526, 1);
      for (let px = x; px <= x + w; px += 24) {
        art.fillRect(px, y - 3, 3, 8);
        art.fillRect(px, y + h - 5, 3, 8);
      }
      for (let py = y; py <= y + h; py += 24) {
        art.fillRect(x - 3, py, 8, 3);
        art.fillRect(x + w - 5, py, 8, 3);
      }
    }

    // winter shed / barn at the top of the track
    art.fillStyle(0x3c2f1f, 1).fillRect(292, 12, 56, 48);
    art.fillStyle(0x8a6a3a, 1).fillRect(286, 6, 68, 10);
    art.fillStyle(0x241b10, 1).fillRect(310, 36, 20, 24);
    art.fillStyle(0xc4703a, 1).fillRect(292, 58, 56, 3);

    // hay bales
    art.fillStyle(0xb99b52, 1);
    for (const [x, y] of [[368, 240], [392, 240], [380, 226]]) art.fillRect(x, y, 16, 12);
  }

  private buildTrees(): void {
    for (const [x, y, variant] of TREE_SPOTS) {
      this.add.image(x, y + 28, `tree_${variant}`)
        .setOrigin(0.5, 1)
        .setDepth(10 + y / 10000);
    }
  }

  private buildTriggers(): TriggerDef[] {
    return [
      { id: 'herd', kind: 'herd', payload: '', label: '查看畜群', radius: 40, x: 320, y: 120 },
      { id: 'pasture-a', kind: 'pasture', payload: 'A', label: '草场 A 区', radius: 40, x: 152, y: 148 },
      { id: 'pasture-b', kind: 'pasture', payload: 'B', label: '草场 B 区', radius: 40, x: 472, y: 148 },
      { id: 'market', kind: 'market', payload: '', label: '去集市', radius: 44, x: 320, y: 36 },
      { id: 'tech', kind: 'tech', payload: '', label: '科技服务', radius: 44, x: 320, y: 420 },
    ];
  }
}
