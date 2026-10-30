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
const ROCK = 16;
const ROCK_BIG = 17;
const BUSH = 18;
const FLOWER = 19;
const TUFT = 20;
const TROUGH = 21;
const BARREL = 22;
const CRATE = 23;
const COLLIDING = [FENCE_H, FENCE_V, POST, WALL, ROOF, WATER, ROCK_BIG];

const TREE_SPOTS: Array<[number, number, number]> = [
  [30, 40, 0], [120, 36, 1], [240, 44, 2], [342, 38, 0],
  [420, 36, 2], [520, 44, 1], [610, 40, 0], [40, 210, 1],
  [600, 210, 2], [30, 470, 0], [140, 478, 1], [250, 470, 2],
  [390, 478, 0], [520, 470, 1], [610, 458, 2],
];

export class RanchScene extends Phaser.Scene {
  private player!: Player;
  private controls!: InputManager;
  private interactions!: InteractionSystem;
  private controller!: RanchInteractionController;
  private wash!: Phaser.GameObjects.Rectangle;
  private snow!: Phaser.GameObjects.Particles.ParticleEmitter;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private propLayer!: Phaser.Tilemaps.TilemapLayer;
  private trees: Phaser.GameObjects.Image[] = [];
  private unsubscribes: Array<() => void> = [];

  constructor() { super('RanchScene'); }

  create(): void {
    const worldW = WORLD_TILES_W * TILE;
    const worldH = WORLD_TILES_H * TILE;

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor('#1b3a5c');

    const { ground, props } = this.buildTilemap();
    this.buildTrees();
    this.spawnHerd();

    const spawn = gameState.getSpawn();
    this.player = new Player(this, spawn.x, spawn.y);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.physics.add.collider(this.player.sprite, ground);
    props.setDepth(1);
    this.buildStructures();

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
    this.buildVignette();

    this.unsubscribes.push(bus.on('state:changed', () => this.applySeasonWash()));
    this.unsubscribes.push(bus.on('calendar:changed', () => {
      this.applySeasonWash();
      this.applySeasonArt();
      this.updateSnow();
    }));

    ui.showHud();
    ui.onEndWeek = endWeekFlow;
    audio.setSeason(gameState.season);
    this.applySeasonWash();
    this.applySeasonArt();
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

  /** Ground layer is fully opaque; props live on a second transparent layer. */
  private buildTilemap(): { ground: Phaser.Tilemaps.TilemapLayer; props: Phaser.Tilemaps.TilemapLayer } {
    const { ground: groundGrid, props: propGrid } = this.buildGrid();

    const groundMap = this.make.tilemap({ data: groundGrid, tileWidth: TILE, tileHeight: TILE });
    const texture = `ranch-tiles-${gameState.season}`;
    const groundTiles = groundMap.addTilesetImage('ranch', texture, TILE, TILE, 0, 0);
    if (!groundTiles) throw new Error('ranch tileset missing');
    const ground = groundMap.createLayer(0, groundTiles, 0, 0)!;
    ground.setDepth(0);
    ground.setCollision(COLLIDING);
    this.groundLayer = ground;

    const propMap = this.make.tilemap({ data: propGrid, tileWidth: TILE, tileHeight: TILE });
    const propTiles = propMap.addTilesetImage('ranch', texture, TILE, TILE, 0, 0);
    const props = propMap.createLayer(0, propTiles!, 0, 0)!;
    props.setDepth(1);
    this.propLayer = props;

    return { ground, props };
  }

  private buildGrid(): { ground: number[][]; props: number[][] } {
    const width = WORLD_TILES_W;
    const height = WORLD_TILES_H;
    const ground: number[][] = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => {
        // smooth, deterministic meadow waves: dark hollows, tufted rises, flower patches
        const wave = Math.sin(x * 0.17) * Math.cos(y * 0.13)
          + Math.sin(x * 0.07 + y * 0.11) * 0.8
          + Math.sin((x + y) * 0.31) * 0.25;
        const pick = wave > 0.55 ? 3 : wave > 0.15 ? 1 : wave < -0.75 ? 2 : 0;
        return GRASS[pick];
      }),
    );
    const props: number[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => -1),
    );

    // crossroads: one north-south track, one east-west branch
    for (let y = 0; y < height; y++) {
      ground[y][19] = DIRT;
      ground[y][20] = DIRT;
    }
    for (let x = 0; x < width; x++) {
      ground[14][x] = DIRT;
      ground[15][x] = DIRT;
    }

    const paddocks: Array<[number, number, number, number]> = [
      [2, 3, 12, 8], [26, 3, 12, 8], [2, 18, 12, 8], [26, 18, 12, 8],
    ];
    for (const [px, py, pw, ph] of paddocks) {
      for (let x = px; x <= px + pw; x++) {
        ground[py][x] = FENCE_H;
        ground[py + ph][x] = FENCE_H;
      }
      for (let y = py; y <= py + ph; y++) {
        ground[y][px] = FENCE_V;
        ground[y][px + pw] = FENCE_V;
      }
      ground[py][px] = POST;
      ground[py][px + pw] = POST;
      ground[py + ph][px] = POST;
      ground[py + ph][px + pw] = POST;

      // a couple of gaps so the paddock reads as a built fence, not a grid
      ground[py][px + Math.floor(pw * 0.6)] = GRASS[0];
      ground[py + ph][px + Math.floor(pw * 0.35)] = GRASS[1];
    }

    // winter shed footprint is covered by the barn sprite placed in buildStructures

    ground[6][22] = HAY;
    ground[7][22] = HAY;
    ground[6][23] = HAY;

    // pond in the south-west
    for (let y = 27; y <= 29; y++) {
      for (let x = 3; x <= 6; x++) ground[y][x] = WATER;
    }

    this.scatterProps(ground, props);
    return { ground, props };
  }

  /** Props clump instead of scattering evenly, so open pasture stays calm. */
  private scatterProps(ground: number[][], props: number[][]): void {
    for (let y = 0; y < ground.length; y++) {
      for (let x = 0; x < ground[y].length; x++) {
        const tile = ground[y][x];
        if (tile !== GRASS[0] && tile !== GRASS[1] && tile !== GRASS[2]) continue;
        const block = ((x >> 2) * 92837111 ^ (y >> 2) * 689287499) >>> 0;
        if (block % 3 !== 0) continue;
        const hash = (x * 374761393 + y * 668265263) >>> 0;
        if (hash % 11 === 0) props[y][x] = ROCK;
        else if (hash % 7 === 0) props[y][x] = BUSH;
        else if (hash % 5 === 0) props[y][x] = FLOWER;
        else if (hash % 3 === 0) props[y][x] = TUFT;
      }
    }

    props[5][16] = BUSH;
    props[9][24] = ROCK_BIG;
    props[12][16] = BUSH;
    props[20][24] = BUSH;
    props[22][16] = CRATE;
    props[10][17] = TROUGH;
    props[11][22] = BARREL;
    props[12][22] = CRATE;

    // soften the hard dirt/grass seam with tufts on the grass side
    const isDirt = (x: number, y: number): boolean => ground[y]?.[x] === DIRT;
    for (let y = 0; y < ground.length; y++) {
      for (let x = 0; x < ground[y].length; x++) {
        if (props[y][x] !== -1) continue;
        if (!isDirt(x - 1, y) && !isDirt(x + 1, y) && !isDirt(x, y - 1) && !isDirt(x, y + 1)) continue;
        const hash = (x * 2654435761 + y * 40503) >>> 0;
        if (hash % 2 === 0) props[y][x] = hash % 6 === 0 ? FLOWER : TUFT;
      }
    }
  }

  /** Barn, sign and their blockers. One clear landmark per screen. */
  private buildStructures(): void {
    if (!this.textures.exists('barn')) return;

    const barn = this.add.image(264, 88, 'barn').setOrigin(0.5, 1);
    barn.setDepth(10 + 88 / 10000);

    const blocker = this.add.rectangle(264, 76, 40, 18).setVisible(false);
    this.physics.add.existing(blocker, true);
    this.physics.add.collider(this.player.sprite, blocker);

    this.add.image(300, 116, 'sign').setOrigin(0.5, 1).setDepth(10 + 116 / 10000);

    const yard: Array<[string, number, number]> = [
      ['well', 318, 152],
      ['woodpile', 224, 134],
      ['cart', 206, 174],
      ['laundry', 332, 108],
    ];
    for (const [key, x, y] of yard) {
      if (!this.textures.exists(key)) continue;
      this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(10 + y / 10000);
    }
  }

  /** Soft vignette: gives a flat top-down field some depth. */
  private buildVignette(): void {
    const key = 'vignette';
    if (!this.textures.exists(key)) {
      const canvas = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (!canvas) return;
      const ctx = canvas.getContext();
      const gradient = ctx.createRadialGradient(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, 70,
        GAME_WIDTH / 2, GAME_HEIGHT / 2, 300,
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(8,12,18,0.5)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      canvas.refresh();
    }
    this.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(860);
  }

  private buildTrees(): void {
    for (const [x, y, variant] of TREE_SPOTS) {
      this.trees.push(
        this.add.image(x, y + 28, `tree_${variant}`)
          .setOrigin(0.5, 1)
          .setDepth(10 + y / 10000),
      );
    }
  }

  /** Swaps the ground tileset and tints the trees to match the season. */
  private applySeasonArt(): void {
    const season = gameState.season;
    const texture = this.textures.get(`ranch-tiles-${season}`);
    if (texture && texture.key !== '__MISSING') {
      for (const layer of [this.groundLayer, this.propLayer]) {
        const tileset = layer?.tileset?.[0];
        if (tileset) tileset.setImage(texture);
      }
    }

    const tint = {
      spring: 0xffffff,
      summer: 0xf2ffe8,
      autumn: 0xe0a050,
      winter: 0x9fb0c0,
    }[season];
    for (const tree of this.trees) tree.setTint(tint);
  }

  private spawnHerd(): void {
    const groups: Array<{ kind: 'yak' | 'sheep'; x0: number; y0: number; x1: number; y1: number; count: number }> = [
      { kind: 'yak', x0: 4, y0: 5, x1: 14, y1: 11, count: 5 },
      { kind: 'sheep', x0: 27, y0: 5, x1: 38, y1: 11, count: 7 },
      { kind: 'yak', x0: 4, y0: 20, x1: 14, y1: 26, count: 4 },
      { kind: 'sheep', x0: 27, y0: 20, x1: 38, y1: 26, count: 6 },
    ];

    for (const group of groups) {
      const clusters = Math.max(1, Math.ceil(group.count / 3));
      for (let i = 0; i < group.count; i++) {
        const cluster = i % clusters;
        const cx = group.x0 + 2 + ((cluster * 7 + 3) % Math.max(1, group.x1 - group.x0 - 4));
        const cy = group.y0 + 2 + ((cluster * 5 + 2) % Math.max(1, group.y1 - group.y0 - 4));
        const jx = (i % 3) - 1;
        const jy = Math.floor(i / 3) % 2 === 0 ? 0 : 1;
        new HerdSprite(this, (cx + jx) * TILE + 8, (cy + jy) * TILE + 8, group.kind);
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
      { id: 'herd', kind: 'herd', payload: '', label: '查看畜群', radius: 40, x: 328, y: 152 },
      { id: 'pasture-a', kind: 'pasture', payload: 'P1', label: '草场 P1 区', radius: 40, x: 136, y: 120 },
      { id: 'pasture-b', kind: 'pasture', payload: 'P2', label: '草场 P2 区', radius: 40, x: 520, y: 120 },
      { id: 'pasture-c', kind: 'pasture', payload: 'P3', label: '草场 P3 区', radius: 40, x: 136, y: 360 },
      { id: 'pasture-d', kind: 'pasture', payload: 'P4', label: '草场 P4 区', radius: 40, x: 520, y: 360 },
      { id: 'market', kind: 'market', payload: '', label: '去集市', radius: 44, x: 264, y: 104 },
      { id: 'tech', kind: 'tech', payload: '', label: '科技服务', radius: 44, x: 328, y: 456 },
    ];
  }
}
