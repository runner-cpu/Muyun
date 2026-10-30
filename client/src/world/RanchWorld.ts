import Phaser from 'phaser';
import { TILE, WORLD_TILES_H, WORLD_TILES_W } from '../config';
import type { Season } from '../types';
import type { RunState } from '../sim/types';
import { pastureUse } from '../sim/rules';
import { pastureAppearance } from './sceneState';

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
const PADDOCKS = [
  { id: 'P1', x: 2, y: 3, width: 12, height: 8 },
  { id: 'P2', x: 26, y: 3, width: 12, height: 8 },
  { id: 'P3', x: 2, y: 18, width: 12, height: 8 },
  { id: 'P4', x: 26, y: 18, width: 12, height: 8 },
];

const TREE_SPOTS: Array<[number, number, number]> = [
  [30, 40, 0], [120, 36, 1], [240, 44, 2], [342, 38, 0],
  [420, 36, 2], [520, 44, 1], [610, 40, 0], [40, 210, 1],
  [600, 210, 2], [30, 470, 0], [140, 478, 1], [250, 470, 2],
  [390, 478, 0], [520, 470, 1], [610, 458, 2],
];

export class RanchWorld {
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private propLayer!: Phaser.Tilemaps.TilemapLayer;
  private trees: Phaser.GameObjects.Image[] = [];
  private pastureMarks!: Phaser.GameObjects.Graphics;
  private pastureSignature = '';

  constructor(private scene: Phaser.Scene) {}

  build(season: Season): { ground: Phaser.Tilemaps.TilemapLayer; props: Phaser.Tilemaps.TilemapLayer } {
    const layers = this.buildTilemap(season);
    this.pastureMarks = this.scene.add.graphics().setDepth(2);
    this.buildTrees();
    return layers;
  }

  /** Ground layer is fully opaque; props live on a second transparent layer. */
  private buildTilemap(season: Season): { ground: Phaser.Tilemaps.TilemapLayer; props: Phaser.Tilemaps.TilemapLayer } {
    const { ground: groundGrid, props: propGrid } = this.buildGrid();

    const groundMap = this.scene.make.tilemap({ data: groundGrid, tileWidth: TILE, tileHeight: TILE });
    const texture = `ranch-tiles-${season}`;
    const groundTiles = groundMap.addTilesetImage('ranch', texture, TILE, TILE, 0, 0);
    if (!groundTiles) throw new Error('ranch tileset missing');
    const ground = groundMap.createLayer(0, groundTiles, 0, 0)!;
    ground.setDepth(0);
    ground.setCollision(COLLIDING);
    this.groundLayer = ground;

    const propMap = this.scene.make.tilemap({ data: propGrid, tileWidth: TILE, tileHeight: TILE });
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

    for (const { x: px, y: py, width: pw, height: ph } of PADDOCKS) {
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
  buildStructures(player: Phaser.Physics.Arcade.Sprite): void {
    if (!this.scene.textures.exists('barn')) return;

    const barn = this.scene.add.image(264, 88, 'barn').setOrigin(0.5, 1);
    barn.setDepth(10 + 88 / 10000);

    const blocker = this.scene.add.rectangle(264, 76, 40, 18).setVisible(false);
    this.scene.physics.add.existing(blocker, true);
    this.scene.physics.add.collider(player, blocker);

    this.scene.add.image(300, 116, 'sign').setOrigin(0.5, 1).setDepth(10 + 116 / 10000);

    const yard: Array<[string, number, number]> = [
      ['well', 318, 152],
      ['woodpile', 224, 134],
      ['cart', 206, 174],
      ['laundry', 332, 108],
    ];
    for (const [key, x, y] of yard) {
      if (!this.scene.textures.exists(key)) continue;
      this.scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(10 + y / 10000);
    }
  }

  private buildTrees(): void {
    for (const [x, y, variant] of TREE_SPOTS) {
      this.trees.push(
        this.scene.add.image(x, y + 28, `tree_${variant}`)
          .setOrigin(0.5, 1)
          .setDepth(10 + y / 10000),
      );
    }
  }

  /** Redraw only paddock interiors; fence collisions and paths keep their original tiles. */
  syncPasture(state: RunState): void {
    const signature = state.pasture.map(cell => `${cell.id}:${cell.biomassKgPerHa.toFixed(1)}:${cell.degradation.toFixed(3)}:${pastureUse(state, cell)}`).join('|');
    if (signature === this.pastureSignature) return;
    this.pastureSignature = signature;
    this.pastureMarks.clear();
    for (const paddock of PADDOCKS) {
      const cell = state.pasture.find(item => item.id === paddock.id);
      if (!cell) continue;
      const { cover, bare } = pastureAppearance(cell);
      const use = pastureUse(state, cell);
      for (let y = paddock.y + 1; y < paddock.y + paddock.height; y++) {
        for (let x = paddock.x + 1; x < paddock.x + paddock.width; x++) {
          const hash = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
          const exposed = hash % 100 / 100 < bare;
          const index = exposed ? DIRT : cover > 0.7 ? GRASS[3]
            : cover > 0.4 ? GRASS[hash % 2] : GRASS[2];
          this.groundLayer.putTileAt(index, x, y);
          const hasTuft = !exposed && use !== 'cut' && (hash >>> 8) % 100 / 100 < cover * 0.45;
          this.propLayer.putTileAt(hasTuft ? TUFT : -1, x, y);
          if (use === 'cut' && !exposed && hash % 3 === 0) {
            this.pastureMarks.fillStyle(0xb59c65, 0.85).fillRect(x * TILE + 4, y * TILE + 9, 6, 1);
          }
        }
      }
      // Small corner brackets communicate current use without tinting away the pixel artwork.
      const color = use === 'grazed' ? 0xe3b46b : use === 'cut' ? 0xb9a36a : 0x83b996;
      this.pastureMarks.lineStyle(1, color, use === 'resting' ? 0.65 : 1);
      const left = (paddock.x + 1) * TILE + 3;
      const right = (paddock.x + paddock.width) * TILE - 3;
      const top = (paddock.y + 1) * TILE + 3;
      const bottom = (paddock.y + paddock.height) * TILE - 3;
      for (const [x, y, dx, dy] of [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
        this.pastureMarks.beginPath().moveTo(x, y + dy * 9).lineTo(x, y).lineTo(x + dx * 9, y).strokePath();
      }
    }
  }

  /** Swaps the ground tileset and tints the trees to match the season. */
  applySeasonArt(season: Season): void {
    const texture = this.scene.textures.get(`ranch-tiles-${season}`);
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

}
