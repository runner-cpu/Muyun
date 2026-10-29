import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, rng } from './lib/pixel.mjs';
import { ACCENT, RAMP } from './theme.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 16;

/** Grass: 70% flat base, 20% tufts, 10% flowers. Variant 3 is a darker meadow patch. */
function grassTile(seed, variant) {
  const tile = new Canvas(TILE, TILE);
  const r = rng(seed);
  const base = variant === 3 ? RAMP.grass[2] : RAMP.grass[3];
  tile.rect(0, 0, TILE, TILE, base);

  // low-frequency patches, 2x2 or 3x2 blocks, never single pixels
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(r() * 13);
    const y = Math.floor(r() * 13);
    const w = 2 + Math.floor(r() * 2);
    tile.rect(x, y, w, 2, r() > 0.5 ? RAMP.grass[2] : (variant === 3 ? RAMP.grass[3] : RAMP.grass[4]));
  }

  const tufts = variant === 0 || variant === 3 ? 0 : variant === 1 ? 1 : 2;
  for (let i = 0; i < tufts; i++) {
    const x = 2 + Math.floor(r() * 11);
    const y = 3 + Math.floor(r() * 10);
    tile.rect(x, y, 2, 1, RAMP.grass[1]);
    tile.px(x + 1, y - 1, RAMP.grass[5]);
    tile.px(x - 1, y + 1, RAMP.grass[2]);
  }

  if (variant === 2) {
    for (let i = 0; i < 2; i++) {
      const x = 3 + Math.floor(r() * 10);
      const y = 3 + Math.floor(r() * 10);
      tile.px(x, y, ACCENT.warm);
      tile.px(x, y + 1, RAMP.grass[1]);
    }
  }
  return tile;
}

function dirtTile(seed, worn) {
  const tile = new Canvas(TILE, TILE);
  const r = rng(seed);
  tile.rect(0, 0, TILE, TILE, worn ? RAMP.dirt[4] : RAMP.dirt[3]);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(r() * 14);
    const y = Math.floor(r() * 14);
    tile.rect(x, y, 2, 1, r() > 0.5 ? RAMP.dirt[2] : RAMP.dirt[5]);
  }
  for (let i = 0; i < 3; i++) {
    tile.px(Math.floor(r() * TILE), Math.floor(r() * TILE), RAMP.dirt[1]);
  }
  return tile;
}

function snowTile(seed) {
  const tile = new Canvas(TILE, TILE);
  const r = rng(seed);
  tile.rect(0, 0, TILE, TILE, RAMP.stone[6]);
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * 13);
    const y = Math.floor(r() * 13);
    tile.rect(x, y, 3, 2, RAMP.stone[5]);
  }
  return tile;
}

/** Fence: one 4px post per tile edge, two 2px rails, 1px shadow under each rail. */
function fenceTile(kind) {
  const tile = grassTile(kind === 'h' ? 201 : 211, 0);
  const post = RAMP.dirt[1];
  const postLight = RAMP.dirt[4];
  const rail = RAMP.dirt[3];
  const railLight = RAMP.dirt[5];
  const shade = RAMP.dirt[0];

  if (kind === 'h') {
    tile.rect(0, 5, TILE, 2, rail);
    tile.rect(0, 5, TILE, 1, railLight);
    tile.rect(0, 7, TILE, 1, shade);
    tile.rect(0, 10, TILE, 2, rail);
    tile.rect(0, 10, TILE, 1, railLight);
    tile.rect(0, 12, TILE, 1, shade);
    tile.rect(0, 2, 4, 12, post);
    tile.rect(0, 2, 1, 12, postLight);
    tile.rect(3, 2, 1, 12, shade);
  } else if (kind === 'v') {
    tile.rect(5, 0, 2, TILE, rail);
    tile.rect(5, 0, 1, TILE, railLight);
    tile.rect(7, 0, 1, TILE, shade);
    tile.rect(10, 0, 2, TILE, rail);
    tile.rect(10, 0, 1, TILE, railLight);
    tile.rect(12, 0, 1, TILE, shade);
    tile.rect(0, 0, 3, TILE, post);
    tile.rect(0, 0, 1, TILE, postLight);
    tile.rect(2, 0, 1, TILE, shade);
  } else {
    tile.rect(6, 1, 5, 13, post);
    tile.rect(6, 1, 1, 13, postLight);
    tile.rect(10, 1, 1, 13, shade);
    tile.rect(5, 14, 7, 1, shade);
  }
  return tile;
}

function hayTile() {
  const tile = grassTile(221, 0);
  tile.rect(1, 6, 14, 8, RAMP.dirt[5]);
  tile.rect(1, 6, 14, 1, RAMP.dirt[6]);
  tile.rect(1, 13, 14, 1, RAMP.dirt[2]);
  for (let y = 8; y < 13; y += 3) tile.rect(2, y, 12, 1, RAMP.dirt[3]);
  tile.rect(7, 6, 2, 8, RAMP.dirt[2]);
  tile.rect(5, 15, 7, 1, ACCENT.cream);
  return tile;
}

function wallTile() {
  const tile = new Canvas(TILE, TILE);
  tile.rect(0, 0, TILE, TILE, RAMP.dirt[2]);
  for (let x = 0; x < TILE; x += 5) tile.rect(x, 0, 1, TILE, RAMP.dirt[1]);
  tile.rect(0, 0, TILE, 1, RAMP.dirt[4]);
  tile.rect(0, TILE - 1, TILE, 1, RAMP.dirt[0]);
  return tile;
}

function roofTile() {
  const tile = new Canvas(TILE, TILE);
  tile.rect(0, 0, TILE, TILE, RAMP.dirt[4]);
  for (let y = 0; y < TILE; y += 4) {
    tile.rect(0, y, TILE, 1, RAMP.dirt[5]);
    tile.rect(0, y + 3, TILE, 1, RAMP.dirt[2]);
    for (let x = (y / 4) % 2 === 0 ? 1 : 5; x < TILE; x += 8) {
      tile.rect(x, y + 1, 1, 2, RAMP.dirt[3]);
    }
  }
  return tile;
}

function waterTile(seed) {
  const tile = new Canvas(TILE, TILE);
  const r = rng(seed);
  tile.rect(0, 0, TILE, TILE, RAMP.water[2]);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(r() * 10);
    const y = Math.floor(r() * 13);
    tile.rect(x, y, 4, 1, RAMP.water[4]);
  }
  tile.rect(0, 0, TILE, 1, RAMP.water[1]);
  return tile;
}

/** Props sit on transparent tiles so the ground shows through. */
function rockTile(seed, big) {
  const tile = new Canvas(TILE, TILE);
  const r = rng(seed);
  const w = big ? 11 : 7;
  const h = big ? 8 : 5;
  const x = big ? 2 : 5;
  const y = big ? 6 : 9;
  tile.ellipse(x + w / 2, y + h + 1, w / 2, 1.5, RAMP.dirt[0], 0.35);
  tile.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, RAMP.stone[2]);
  tile.ellipse(x + w / 2 - 1, y + h / 2 - 1, w / 2 - 2, h / 2 - 1, RAMP.stone[3]);
  tile.rect(x + 1, y + 1, 3, 1, RAMP.stone[5]);
  for (let i = 0; i < 3; i++) tile.px(x + 1 + Math.floor(r() * w), y + 2, RAMP.stone[1]);
  return tile;
}

function bushTile(seed) {
  const tile = new Canvas(TILE, TILE);
  const r = rng(seed);
  tile.ellipse(8, 13, 6, 2, RAMP.dirt[0], 0.35);
  tile.circle(6, 9, 4, RAMP.grass[1]);
  tile.circle(10, 8, 5, RAMP.grass[2]);
  tile.circle(8, 10, 4, RAMP.grass[2]);
  tile.circle(9, 8, 3, RAMP.grass[4]);
  tile.circle(10, 7, 2, RAMP.grass[5]);
  for (let i = 0; i < 4; i++) tile.px(5 + Math.floor(r() * 8), 7 + Math.floor(r() * 5), ACCENT.cream);
  return tile;
}

function flowerPatch(seed) {
  const tile = new Canvas(TILE, TILE);
  const r = rng(seed + 3);
  for (let i = 0; i < 4; i++) {
    const x = 3 + Math.floor(r() * 10);
    const y = 4 + Math.floor(r() * 8);
    tile.px(x, y, ACCENT.warm);
    tile.px(x, y + 1, RAMP.grass[1]);
    if (i % 2 === 0) tile.px(x + 1, y, ACCENT.red);
  }
  return tile;
}

function tuftTile(seed) {
  const tile = new Canvas(TILE, TILE);
  const r = rng(seed);
  tile.ellipse(8, 13, 4, 1, RAMP.grass[1], 0.5);
  for (let i = 0; i < 7; i++) {
    const x = 4 + Math.floor(r() * 8);
    const h = 3 + Math.floor(r() * 3);
    tile.rect(x, 13 - h, 1, h, RAMP.grass[1]);
    tile.px(x, 12 - h, RAMP.grass[6]);
  }
  return tile;
}

function troughTile() {
  const tile = new Canvas(TILE, TILE);
  tile.ellipse(8, 14, 6, 1.5, RAMP.dirt[0], 0.35);
  tile.rect(2, 6, 12, 6, RAMP.dirt[2]);
  tile.rect(2, 6, 12, 2, RAMP.dirt[4]);
  tile.rect(3, 8, 10, 3, RAMP.water[3]);
  tile.rect(3, 8, 10, 1, RAMP.water[5]);
  tile.rect(2, 11, 12, 1, RAMP.dirt[1]);
  return tile;
}

function barrelTile() {
  const tile = new Canvas(TILE, TILE);
  tile.ellipse(8, 14, 5, 1.5, RAMP.dirt[0], 0.35);
  tile.rect(4, 4, 8, 10, RAMP.dirt[3]);
  tile.rect(4, 4, 8, 1, RAMP.dirt[5]);
  tile.rect(4, 7, 8, 1, RAMP.dirt[1]);
  tile.rect(4, 11, 8, 1, RAMP.dirt[1]);
  tile.rect(11, 4, 1, 10, RAMP.dirt[2]);
  return tile;
}

function crateTile() {
  const tile = new Canvas(TILE, TILE);
  tile.ellipse(8, 14, 5, 1.5, RAMP.dirt[0], 0.35);
  tile.rect(3, 5, 10, 9, RAMP.dirt[4]);
  tile.rect(3, 5, 10, 1, RAMP.dirt[6]);
  tile.rect(3, 13, 10, 1, RAMP.dirt[2]);
  tile.rect(7, 5, 2, 9, RAMP.dirt[3]);
  tile.rect(3, 8, 10, 1, RAMP.dirt[3]);
  return tile;
}

const TILES = [
  () => grassTile(11, 0),
  () => grassTile(23, 1),
  () => grassTile(37, 2),
  () => grassTile(41, 3),
  () => dirtTile(53, false),
  () => dirtTile(61, true),
  () => snowTile(71),
  () => snowTile(73),
  () => fenceTile('h'),
  () => fenceTile('v'),
  () => fenceTile('post'),
  () => fenceTile('h'),
  hayTile,
  wallTile,
  roofTile,
  () => waterTile(83),
  () => rockTile(91, false),
  () => rockTile(97, true),
  () => bushTile(101),
  () => flowerPatch(103),
  () => tuftTile(107),
  troughTile,
  barrelTile,
  crateTile,
  () => bushTile(109),
  () => tuftTile(113),
  () => flowerPatch(127),
  () => rockTile(131, false),
  () => bushTile(137),
  () => tuftTile(139),
  () => rockTile(149, false),
  () => grassTile(151, 1),
];

function writeSheet() {
  const sheet = new Canvas(TILE * 16, TILE * 2);
  TILES.forEach((make, i) => {
    const tile = make();
    const ox = (i % 16) * TILE;
    const oy = Math.floor(i / 16) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const idx = (y * TILE + x) * 4;
        if (tile.data[idx + 3] === 0) continue;
        sheet.px(ox + x, oy + y,
          [tile.data[idx], tile.data[idx + 1], tile.data[idx + 2]],
          tile.data[idx + 3] / 255);
      }
    }
  });
  const path = join(ROOT, 'client/public/assets/tilesets/ranch-tiles.png');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, sheet.toPng());
  return path;
}

console.log('tiles:', writeSheet().replace(ROOT, '.'));
