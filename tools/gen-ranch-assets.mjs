import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, rng } from './lib/pixel.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 16;

/**
 * 32-colour plateau palette. Cold sky, dry grass, dark yak, blue-white snow,
 * one warm accent for buildings and UI callbacks.
 */
const P = {
  grass: '#77743A',
  grassDark: '#676432',
  grassLight: '#8C8744',
  grassPale: '#9B9550',
  dirt: '#6B5A3A',
  dirtLight: '#7A6844',
  snow: '#DCE8EE',
  snowShade: '#C4D6E0',
  wood: '#5B4526',
  woodLight: '#8A6A3A',
  woodDark: '#3D2F1D',
  water: '#3A5C7A',
  waterLight: '#5A7C9A',
  hay: '#B99B52',
  hayDark: '#8E7538',
  wall: '#3C2F1F',
  roof: '#8A6A3A',
  flower: '#C4703A',
  white: '#F4ECD8',
};

function grassTile(seed) {
  const c = new Canvas(TILE, TILE);
  const r = rng(seed);
  c.rect(0, 0, TILE, TILE, P.grass);
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(r() * TILE);
    const y = Math.floor(r() * TILE);
    c.px(x, y, r() > 0.5 ? P.grassDark : P.grassLight);
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * TILE);
    const y = Math.floor(r() * TILE);
    c.px(x, y, P.grassPale);
    c.px(x, y - 1, P.grassPale);
  }
  return c;
}

function dirtTile(seed) {
  const c = new Canvas(TILE, TILE);
  const r = rng(seed);
  c.rect(0, 0, TILE, TILE, P.dirt);
  for (let i = 0; i < 22; i++) {
    c.px(Math.floor(r() * TILE), Math.floor(r() * TILE), r() > 0.5 ? P.dirtLight : '#5C4C30');
  }
  return c;
}

function snowTile(seed) {
  const c = new Canvas(TILE, TILE);
  const r = rng(seed);
  c.rect(0, 0, TILE, TILE, P.snow);
  for (let i = 0; i < 14; i++) {
    c.px(Math.floor(r() * TILE), Math.floor(r() * TILE), P.snowShade);
  }
  return c;
}

function fenceTile(kind) {
  const c = grassTile(kind === 'h' ? 131 : 137);
  if (kind === 'h') {
    c.rect(0, 5, TILE, 2, P.woodLight);
    c.rect(0, 10, TILE, 2, P.wood);
    c.rect(3, 3, 2, 11, P.woodDark);
    c.rect(11, 3, 2, 11, P.woodDark);
  } else if (kind === 'v') {
    c.rect(5, 0, 2, TILE, P.woodLight);
    c.rect(10, 0, 2, TILE, P.wood);
    c.rect(3, 3, 11, 2, P.woodDark);
    c.rect(3, 11, 11, 2, P.woodDark);
  } else {
    c.rect(6, 2, 4, 12, P.woodDark);
    c.rect(7, 2, 2, 12, P.woodLight);
  }
  return c;
}

function hayTile() {
  const c = new Canvas(TILE, TILE);
  c.rect(1, 6, 14, 8, P.hay);
  c.rect(1, 6, 14, 2, P.hayDark);
  for (let y = 8; y < 14; y += 3) c.rect(2, y, 12, 1, P.hayDark);
  c.rect(7, 5, 2, 10, P.hayDark);
  return c;
}

function wallTile() {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, P.wall);
  for (let x = 0; x < TILE; x += 4) c.rect(x, 0, 1, TILE, '#2A2116');
  c.rect(0, 0, TILE, 1, '#4A3A26');
  return c;
}

function roofTile() {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, P.roof);
  for (let y = 0; y < TILE; y += 4) {
    c.rect(0, y, TILE, 1, '#A07C48');
    for (let x = (y / 4) % 2 === 0 ? 0 : 4; x < TILE; x += 8) c.rect(x, y + 1, 1, 3, P.woodDark);
  }
  return c;
}

function waterTile() {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, P.water);
  c.rect(2, 5, 6, 1, P.waterLight);
  c.rect(8, 10, 5, 1, P.waterLight);
  c.rect(4, 13, 4, 1, P.waterLight);
  return c;
}

function flowerTile(seed) {
  const c = grassTile(seed);
  const r = rng(seed + 7);
  for (let i = 0; i < 3; i++) {
    c.px(Math.floor(r() * 14) + 1, Math.floor(r() * 12) + 2, P.flower);
  }
  return c;
}

function writeTiles() {
  const tiles = [
    grassTile(11), grassTile(23), grassTile(37), grassTile(41),
    dirtTile(53), dirtTile(61), snowTile(71), snowTile(73),
    fenceTile('h'), fenceTile('v'), fenceTile('post'), flowerTile(97),
    hayTile(), wallTile(), roofTile(), waterTile(),
  ];
  const sheet = new Canvas(TILE * tiles.length, TILE);
  tiles.forEach((tile, i) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const idx = (y * TILE + x) * 4;
        if (tile.data[idx + 3] === 0) continue;
        sheet.px(i * TILE + x, y, [tile.data[idx], tile.data[idx + 1], tile.data[idx + 2]], tile.data[idx + 3] / 255);
      }
    }
  });
  const path = join(ROOT, 'client/public/assets/tilesets/ranch-tiles.png');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, sheet.toPng());
  return path;
}

const YAK = { body: '#1A1612', shade: '#322A22', horn: '#E8E0CE', hoof: '#0C0A08' };
const SHEEP = { body: '#E8E4D8', shade: '#C9C4B4', face: '#2A2622', hoof: '#1A1612' };

function drawAnimal(canvas, ox, oy, kind, dir, frame) {
  const pal = kind === 'yak' ? YAK : SHEEP;
  const bob = frame === 1 ? 1 : 0;
  const cy = oy + 8 + bob;
  const rx = kind === 'yak' ? 5 : 4;
  const ry = kind === 'yak' ? 4 : 3;

  canvas.ellipse(ox + 8, oy + 14, 4, 1, '#000000', 0.28);
  canvas.ellipse(ox + 8, cy, rx, ry, pal.body);
  canvas.ellipse(ox + 8, cy + 1, rx - 1, ry - 1, pal.shade, 0.55);

  let hx = ox + 8;
  let hy = cy + (dir === 'up' ? -4 : 4);
  if (dir === 'left') { hx = ox + 4; hy = cy; }
  if (dir === 'right') { hx = ox + 12; hy = cy; }

  canvas.circle(hx, hy, kind === 'yak' ? 3 : 2, pal.body);
  if (kind === 'yak' && dir !== 'up') {
    canvas.px(hx - 4, hy - 1, pal.horn);
    canvas.px(hx + 4, hy - 1, pal.horn);
    canvas.px(hx - 4, hy - 2, pal.horn);
    canvas.px(hx + 4, hy - 2, pal.horn);
  }
  if (kind === 'sheep') canvas.circle(hx, hy, 1, pal.face);

  canvas.px(ox + 4, cy + ry, pal.hoof);
  canvas.px(ox + 11, cy + ry, pal.hoof);
  if (frame === 1) {
    canvas.px(ox + 5, cy + ry + 1, pal.hoof);
    canvas.px(ox + 10, cy + ry + 1, pal.hoof);
  }
}

function writeAnimals(kind) {
  const dirs = ['down', 'left', 'right', 'up'];
  const sheet = new Canvas(32, 64);
  dirs.forEach((dir, row) => {
    for (let frame = 0; frame < 2; frame++) {
      drawAnimal(sheet, frame * 16, row * 16, kind, dir, frame);
    }
  });
  const path = join(ROOT, `client/public/assets/sprites/${kind}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, sheet.toPng());
  return path;
}

const outputs = [writeTiles(), writeAnimals('yak'), writeAnimals('sheep')];
console.log('wrote', outputs.map((p) => p.replace(ROOT, '.')).join(', '));
