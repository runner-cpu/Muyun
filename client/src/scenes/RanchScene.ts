import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TILE, WORLD_TILES_H, WORLD_TILES_W } from '../config';
import { gameState } from '../core/GameState';
import { bus } from '../core/emitter';
import { Player } from '../entities/Player';
import { HerdSprite } from '../entities/Animal';
import { InputManager } from '../systems/InputManager';
import { InteractionSystem } from '../systems/InteractionSystem';
import { RanchInteractionController } from '../systems/RanchInteractionController';
import { tintForSeason } from '../systems/Calendar';
import { audio } from '../systems/AudioManager';
import { endWeekFlow } from '../systems/WeekFlow';
import { ui } from '../ui/instance';
import type { TriggerDef } from '../types';

const GRASS = [0, 1, 2, 3];
const DIRT = 4;
const FENCE_H = 8;
const FENCE_V = 9;
const POST = 10;
const HAY = 12;
const WALL = 13;
const ROOF = 14;
const WATER = 15;
const COLLIDING = [FENCE_H, FENCE_V, POST, WALL, ROOF, WATER];

const TREE_SPOTS: Array<[number, number, number]> = [
  [14, 62, 0], [92, 40, 1], [186, 70, 2], [300, 40, 0],
  [336, 96, 2], [420, 52, 1], [520, 68, 0], [604, 120, 2],
  [24, 236, 1], [40, 400, 0], [150, 444, 2], [520, 430, 1],
  [590, 372, 0], [610, 268, 2],
];

export class RanchScene extends Phaser.Scene {
  private player!: Player;
  private controls!: InputManager;
  private interactions!: InteractionSystem;
  private controller!: RanchInteractionController;
  private wash!: Phaser.GameObjects.Rectangle;
  private snow!: Phaser.GameObjects.Particles.ParticleEmitter;
  private unsubscribes: Array<() => void> = [];

  constructor() { super('RanchScene'); }

  create(): void {
    const worldW = WORLD_TILES_W * TILE;
    const worldH = WORLD_TILES_H * TILE;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor('#1b3a5c');

    const collision = this.buildTilemap();
    this.buildTrees();
    this.spawnHerd();

    const spawn = gameState.getSpawn();
    this.player = new Player(this, spawn.x, spawn.y);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.physics.add.collider(this.player.sprite, collision);

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
    this.buildSnow();

    this.unsubscribes.push(bus.on('state:changed', () => this.applySeasonWash()));
    this.unsubscribes.push(bus.on('calendar:changed', () => {
      this.applySeasonWash();
      this.updateSnow();
    }));

    ui.showHud();
    ui.onEndWeek = endWeekFlow;
    audio.setSeason(gameState.season);
    this.applySeasonWash();
    this.updateSnow();

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

  private updateSnow(): void {
    if (this.snow) this.snow.emitting = gameState.season === 'winter';
  }

  /** Builds the 40×30 pasture from a code-generated tile grid. */
  private buildTilemap(): Phaser.Tilemaps.TilemapLayer {
    const grid = this.buildGrid();
    const map = this.make.tilemap({ data: grid, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('ranch', 'ranch-tiles', TILE, TILE, 0, 0);
    if (!tileset) throw new Error('ranch tileset missing');
    const layer = map.createLayer(0, tileset, 0, 0)!;
    layer.setDepth(0);
    layer.setCollision(COLLIDING);
    return layer;
  }

  private buildGrid(): number[][] {
    const width = WORLD_TILES_W;
    const height = WORLD_TILES_H;
    const grid: number[][] = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => {
        if ((x * 7 + y * 13) % 19 === 0) return GRASS[3];
        if ((x * 3 + y * 5) % 11 === 0) return GRASS[1];
        return GRASS[0];
      }),
    );

    // main track north-south
    for (let y = 0; y < height; y++) {
      grid[y][19] = DIRT;
      grid[y][20] = DIRT;
    }

    const paddocks: Array<[number, number, number, number]> = [
      [2, 4, 15, 10], [24, 4, 14, 10], [2, 16, 15, 10], [24, 16, 14, 10],
    ];
    for (const [px, py, pw, ph] of paddocks) {
      for (let x = px; x <= px + pw; x++) {
        grid[py][x] = FENCE_H;
        grid[py + ph][x] = FENCE_H;
      }
      for (let y = py; y <= py + ph; y++) {
        grid[y][px] = FENCE_V;
        grid[y][px + pw] = FENCE_V;
      }
      grid[py][px] = POST;
      grid[py][px + pw] = POST;
      grid[py + ph][px] = POST;
      grid[py + ph][px + pw] = POST;
    }

    // winter shed west of the track
    for (let y = 1; y <= 3; y++) {
      for (let x = 16; x <= 18; x++) grid[y][x] = y === 1 ? ROOF : WALL;
    }

    // hay bales beside the shed
    grid[5][22] = HAY;
    grid[6][22] = HAY;
    grid[5][23] = HAY;

    // pond in the south-west
    for (let y = 27; y <= 29; y++) {
      for (let x = 3; x <= 6; x++) grid[y][x] = WATER;
    }

    return grid;
  }

  private buildTrees(): void {
    for (const [x, y, variant] of TREE_SPOTS) {
      this.add.image(x, y + 28, `tree_${variant}`)
        .setOrigin(0.5, 1)
        .setDepth(10 + y / 10000);
    }
  }

  private spawnHerd(): void {
    const groups: Array<{ kind: 'yak' | 'sheep'; x0: number; y0: number; x1: number; y1: number; count: number }> = [
      { kind: 'yak', x0: 4, y0: 6, x1: 16, y1: 13, count: 5 },
      { kind: 'sheep', x0: 25, y0: 6, x1: 37, y1: 13, count: 7 },
      { kind: 'yak', x0: 4, y0: 18, x1: 16, y1: 25, count: 4 },
      { kind: 'sheep', x0: 25, y0: 18, x1: 37, y1: 25, count: 6 },
    ];

    for (const group of groups) {
      for (let i = 0; i < group.count; i++) {
        const tx = group.x0 + ((i * 5 + 3) % Math.max(1, group.x1 - group.x0));
        const ty = group.y0 + ((i * 7 + 2) % Math.max(1, group.y1 - group.y0));
        new HerdSprite(this, tx * TILE + 8, ty * TILE + 8, group.kind);
      }
    }
  }

  private buildSnow(): void {
    if (!this.textures.exists('snowflake')) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.9).fillRect(0, 0, 2, 2);
      g.generateTexture('snowflake', 2, 2);
      g.destroy();
    }
    this.snow = this.add.particles(0, 0, 'snowflake', {
      x: { min: 0, max: GAME_WIDTH },
      y: -8,
      lifespan: 4200,
      speedY: { min: 18, max: 46 },
      speedX: { min: -12, max: 12 },
      scale: { min: 0.5, max: 1.1 },
      alpha: { start: 0.9, end: 0.2 },
      frequency: 90,
      quantity: 1,
    });
    this.snow.setScrollFactor(0).setDepth(800);
    this.snow.emitting = false;
  }

  private buildTriggers(): TriggerDef[] {
    return [
      { id: 'herd', kind: 'herd', payload: '', label: '查看畜群', radius: 40, x: 320, y: 120 },
      { id: 'pasture-a', kind: 'pasture', payload: 'P1', label: '草场 P1 区', radius: 40, x: 152, y: 148 },
      { id: 'pasture-b', kind: 'pasture', payload: 'P2', label: '草场 P2 区', radius: 40, x: 472, y: 148 },
      { id: 'pasture-c', kind: 'pasture', payload: 'P3', label: '草场 P3 区', radius: 40, x: 152, y: 340 },
      { id: 'pasture-d', kind: 'pasture', payload: 'P4', label: '草场 P4 区', radius: 40, x: 472, y: 340 },
      { id: 'market', kind: 'market', payload: '', label: '去集市', radius: 44, x: 320, y: 36 },
      { id: 'tech', kind: 'tech', payload: '', label: '科技服务', radius: 44, x: 320, y: 420 },
    ];
  }
}
