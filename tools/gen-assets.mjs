import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'client', 'public', 'assets');

/* ---------- tiny PNG encoder ---------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- drawing helpers ---------- */
function color(hex, alpha = 255) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), alpha];
}

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }
  px(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const rgba = typeof c === 'string' ? color(c) : c;
    if (rgba[3] === 255) {
      this.data[i] = rgba[0];
      this.data[i + 1] = rgba[1];
      this.data[i + 2] = rgba[2];
      this.data[i + 3] = 255;
      return;
    }
    const a = rgba[3] / 255;
    const da = this.data[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa === 0) return;
    this.data[i] = Math.round((rgba[0] * a + this.data[i] * da * (1 - a)) / oa);
    this.data[i + 1] = Math.round((rgba[1] * a + this.data[i + 1] * da * (1 - a)) / oa);
    this.data[i + 2] = Math.round((rgba[2] * a + this.data[i + 2] * da * (1 - a)) / oa);
    this.data[i + 3] = Math.round(oa * 255);
  }
  rect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  circle(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c);
      }
    }
  }
  save(path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, encodePng(this.w, this.h, this.data));
  }
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- tileset: 16 columns x 2 rows ---------- */
const P = {
  grass: '#5d9b4a',
  grassDark: '#4e8540',
  grassLight: '#73b25a',
  path: '#c9a66b',
  pathDark: '#b58e55',
  pathLight: '#ddbd82',
  plaza: '#b8b8a8',
  plazaDark: '#a0a08f',
  plazaLight: '#c8c8b8',
  road: '#4a4a55',
  roadDark: '#3b3b45',
  line: '#e8d8a0',
  water: '#3a7db5',
  waterDark: '#2f6699',
  waterLight: '#5da3d1',
  cream: '#e8d8b0',
  creamDark: '#cdb98c',
  brick: '#a5563f',
  brickDark: '#8a4534',
  window: '#79c7e3',
  windowDark: '#4a9bbd',
  wood: '#7a5230',
  woodDark: '#5e3d22',
  leaf: '#3f7d3c',
  leafLight: '#5aa34a',
  leafDark: '#2e5e2e',
  trunk: '#6b4a2f',
  trunkDark: '#513720',
  stone: '#8d8d8d',
  track: '#b5533c',
  trackDark: '#98432f',
  court: '#3f7d5a',
  courtDark: '#33664a',
  yellow: '#f2c14e',
  white: '#f4f4f4',
  black: '#1a1c2c',
  roof: '#7a3b3b',
  roofDark: '#5e2c2c',
  roofLight: '#95504a',
};

const tiles = new Canvas(16 * 16, 16 * 2);
const T = 16;

function cell(index, draw) {
  const ox = (index % 16) * T;
  const oy = Math.floor(index / 16) * T;
  draw(ox, oy);
}

function grassBase(ox, oy, r) {
  tiles.rect(ox, oy, T, T, P.grass);
  for (let i = 0; i < 18; i++) {
    const x = ox + Math.floor(r() * 16);
    const y = oy + Math.floor(r() * 16);
    tiles.px(x, y, r() > 0.5 ? P.grassDark : P.grassLight);
  }
}

cell(0, (ox, oy) => grassBase(ox, oy, rng(1)));
cell(1, (ox, oy) => {
  grassBase(ox, oy, rng(2));
  for (const [x, y, c] of [[3, 5, P.white], [11, 3, P.yellow], [7, 11, P.white], [12, 12, P.yellow]]) {
    tiles.px(ox + x, oy + y, c);
    tiles.px(ox + x + 1, oy + y, c);
  }
});
cell(2, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.path);
  const r = rng(3);
  for (let i = 0; i < 14; i++) tiles.px(ox + (r() * 16 | 0), oy + (r() * 16 | 0), P.pathDark);
  for (let i = 0; i < 5; i++) tiles.px(ox + (r() * 16 | 0), oy + (r() * 16 | 0), P.pathLight);
});
cell(3, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.plaza);
  tiles.rect(ox, oy, T, 1, P.plazaDark);
  tiles.rect(ox, oy, 1, T, P.plazaDark);
  tiles.rect(ox, oy + 8, T, 1, P.plazaDark);
  tiles.rect(ox + 8, oy, 1, T, P.plazaDark);
  for (let i = 0; i < 8; i++) tiles.px(ox + 2 + (i * 3) % 13, oy + 2 + (i * 5) % 13, P.plazaLight);
});
cell(4, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.road);
  const r = rng(4);
  for (let i = 0; i < 20; i++) tiles.px(ox + (r() * 16 | 0), oy + (r() * 16 | 0), P.roadDark);
});
cell(5, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.road);
  tiles.rect(ox + 2, oy + 7, 8, 2, P.line);
  tiles.rect(ox + 12, oy + 7, 4, 2, P.line);
});
cell(6, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.water);
  tiles.rect(ox + 2, oy + 4, 6, 1, P.waterLight);
  tiles.rect(ox + 9, oy + 10, 5, 1, P.waterLight);
  tiles.rect(ox + 5, oy + 13, 6, 1, P.waterDark);
});
cell(7, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.waterDark);
  tiles.rect(ox + 1, oy + 1, T - 2, T - 2, P.water);
  tiles.rect(ox + 4, oy + 6, 7, 1, P.waterLight);
});
cell(8, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.cream);
  tiles.rect(ox, oy + 4, T, 1, P.creamDark);
  tiles.rect(ox, oy + 9, T, 1, P.creamDark);
  tiles.rect(ox, oy + 14, T, 1, P.creamDark);
  tiles.rect(ox + 4, oy + 1, 1, 3, P.creamDark);
  tiles.rect(ox + 12, oy + 6, 1, 3, P.creamDark);
  tiles.rect(ox + 7, oy + 11, 1, 3, P.creamDark);
});
cell(9, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.brick);
  for (let y = 0; y < 16; y += 4) tiles.rect(ox, oy + y, T, 1, P.brickDark);
  tiles.rect(ox + 4, oy + 1, 1, 3, P.brickDark);
  tiles.rect(ox + 12, oy + 5, 1, 3, P.brickDark);
  tiles.rect(ox + 7, oy + 9, 1, 3, P.brickDark);
  tiles.rect(ox + 2, oy + 13, 1, 3, P.brickDark);
});
cell(10, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.cream);
  tiles.rect(ox + 2, oy + 2, 12, 12, P.creamDark);
  tiles.rect(ox + 3, oy + 3, 10, 10, P.window);
  tiles.rect(ox + 3, oy + 3, 10, 1, P.white);
  tiles.rect(ox + 7, oy + 3, 1, 10, P.creamDark);
  tiles.rect(ox + 3, oy + 8, 10, 1, P.creamDark);
  tiles.rect(ox + 1, oy + 13, 14, 2, P.cream);
});
cell(11, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.cream);
  tiles.rect(ox + 3, oy + 1, 10, 15, P.woodDark);
  tiles.rect(ox + 4, oy + 1, 8, 15, P.wood);
  tiles.rect(ox + 5, oy + 4, 6, 8, '#8d6039');
  tiles.px(ox + 11, oy + 8, P.yellow);
  tiles.px(ox + 11, oy + 9, P.yellow);
});
cell(12, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.roof);
  for (let y = 2; y < 16; y += 4) {
    tiles.rect(ox, oy + y, T, 1, P.roofDark);
    for (let x = 2; x < 16; x += 5) tiles.rect(ox + x, oy + y - 3, 1, 3, P.roofLight);
  }
});
cell(13, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.roofLight);
  tiles.rect(ox, oy + 3, T, 1, P.roof);
  tiles.rect(ox, oy + 4, T, 12, P.roof);
  for (let x = 0; x < 16; x += 4) tiles.rect(ox + x, oy + 5, 2, 1, P.roofDark);
});
cell(14, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.stone);
  tiles.rect(ox, oy, T, 1, '#c0c0c0');
  for (let y = 4; y < 16; y += 4) tiles.rect(ox, oy + y, T, 1, '#6e6e6e');
});
cell(15, (ox, oy) => {
  tiles.circle(ox + 8, oy + 9, 7, P.leafDark);
  tiles.circle(ox + 8, oy + 8, 6, P.leaf);
  tiles.circle(ox + 5, oy + 5, 3, P.leafLight);
  tiles.circle(ox + 11, oy + 6, 2, P.leafLight);
  tiles.rect(ox + 7, oy + 14, 2, 2, P.trunk);
});
cell(16, (ox, oy) => {
  tiles.rect(ox + 6, oy, 4, 15, P.trunkDark);
  tiles.rect(ox + 7, oy, 2, 15, P.trunk);
  tiles.rect(ox + 4, oy + 13, 8, 3, P.trunkDark);
});
cell(17, (ox, oy) => {
  tiles.rect(ox, oy + 2, T, 12, P.leafDark);
  tiles.rect(ox, oy + 3, T, 10, P.leaf);
  for (let x = 1; x < 16; x += 3) tiles.rect(ox + x, oy + 4 + (x % 4), 2, 2, P.leafLight);
});
cell(18, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.track);
  const r = rng(7);
  for (let i = 0; i < 24; i++) tiles.px(ox + (r() * 16 | 0), oy + (r() * 16 | 0), P.trackDark);
});
cell(19, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.track);
  tiles.rect(ox, oy + 7, T, 2, P.white);
});
cell(20, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.court);
  const r = rng(8);
  for (let i = 0; i < 20; i++) tiles.px(ox + (r() * 16 | 0), oy + (r() * 16 | 0), P.courtDark);
});
cell(21, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.court);
  tiles.rect(ox + 7, oy, 2, T, P.white);
});
cell(22, (ox, oy) => {
  tiles.rect(ox + 2, oy + 4, 12, 3, P.woodDark);
  tiles.rect(ox + 2, oy + 5, 12, 2, P.wood);
  tiles.rect(ox + 2, oy + 9, 12, 3, P.wood);
  tiles.rect(ox + 3, oy + 9, 10, 1, '#8d6039');
  tiles.rect(ox + 3, oy + 12, 2, 3, P.woodDark);
  tiles.rect(ox + 11, oy + 12, 2, 3, P.woodDark);
});
cell(23, (ox, oy) => {
  tiles.rect(ox + 7, oy + 5, 2, 11, '#4b4b58');
  tiles.rect(ox + 5, oy + 15, 6, 1, '#2f2f38');
  tiles.rect(ox + 5, oy + 2, 6, 4, P.yellow);
  tiles.rect(ox + 6, oy + 1, 4, 1, '#ffe9a8');
  tiles.rect(ox + 6, oy + 6, 4, 1, '#c99a2e');
});
cell(24, (ox, oy) => {
  tiles.rect(ox, oy, T, T, '#6b4a2f');
  tiles.rect(ox, oy, T, 1, P.stone);
  tiles.rect(ox, oy + 15, T, 1, P.stone);
  for (const [x, y, c] of [[3, 4, P.yellow], [10, 3, P.white], [6, 10, P.white], [12, 11, P.yellow]]) {
    tiles.px(ox + x, oy + y, c);
    tiles.px(ox + x + 1, oy + y, c);
  }
});
cell(25, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.stone);
  tiles.rect(ox + 1, oy + 1, 14, 14, P.water);
  tiles.rect(ox + 2, oy + 2, 12, 12, P.waterLight);
  tiles.rect(ox + 4, oy + 4, 8, 8, P.water);
  tiles.circle(ox + 8, oy + 8, 2, P.waterLight);
});
cell(26, (ox, oy) => {
  for (let x = 1; x < 16; x += 4) tiles.rect(ox + x, oy + 3, 2, 11, '#5d5d68');
  tiles.rect(ox, oy + 5, T, 2, '#73737e');
  tiles.rect(ox, oy + 11, T, 2, '#73737e');
});
cell(27, (ox, oy) => {
  tiles.rect(ox + 7, oy + 7, 2, 9, P.woodDark);
  tiles.rect(ox + 2, oy + 2, 12, 7, P.woodDark);
  tiles.rect(ox + 3, oy + 3, 10, 5, P.cream);
  tiles.rect(ox + 5, oy + 5, 6, 1, P.woodDark);
});
cell(28, (ox, oy) => {
  tiles.rect(ox, oy, T, T, P.roofDark);
  tiles.rect(ox, oy, T, 2, P.roofLight);
  for (let x = 2; x < 16; x += 5) tiles.rect(ox + x, oy + 4, 1, 10, P.roof);
});
cell(29, (ox, oy) => tiles.rect(ox, oy, T, T, [0, 0, 0, 55]));
// 30 = transparent collision-only tile
cell(31, () => {});

tiles.save(join(OUT, 'tilesets', 'campus-tiles.png'));

/* ---------- player: 4 directions x 4 frames, 16x24 ---------- */
const player = new Canvas(16 * 4, 24 * 4);
const skin = '#f0c090';
const hair = '#4a2f21';
const hairLight = '#6b442f';
const shirt = '#e8e8f0';
const accent = '#3d6fb6';
const pants = '#2e3a59';
const shoe = '#1a1c2c';

function charFrame(ox, oy, dir, frame) {
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const bob = frame === 1 || frame === 3 ? 1 : 0;
  const x = ox;
  const y = oy + bob;
  // legs
  player.rect(x + 5, y + 17, 2, 5, pants);
  player.rect(x + 9, y + 17, 2, 5, pants);
  if (step > 0) {
    player.rect(x + 4, y + 21, 3, 2, shoe);
    player.rect(x + 9, y + 20, 3, 2, shoe);
  } else if (step < 0) {
    player.rect(x + 5, y + 20, 3, 2, shoe);
    player.rect(x + 10, y + 21, 3, 2, shoe);
  } else {
    player.rect(x + 4, y + 21, 3, 2, shoe);
    player.rect(x + 9, y + 21, 3, 2, shoe);
  }
  // body outline + shirt
  player.rect(x + 3, y + 9, 10, 9, hair);
  player.rect(x + 4, y + 9, 8, 8, shirt);
  player.rect(x + 4, y + 14, 8, 2, accent);
  // arms
  if (dir === 'left') {
    player.rect(x + 2, y + 10 + step, 2, 6, shirt);
    player.rect(x + 13, y + 10 - step, 2, 6, shirt);
  } else if (dir === 'right') {
    player.rect(x + 2, y + 10 - step, 2, 6, shirt);
    player.rect(x + 13, y + 10 + step, 2, 6, shirt);
  } else {
    player.rect(x + 2, y + 10 + step, 2, 6, shirt);
    player.rect(x + 13, y + 10 - step, 2, 6, shirt);
  }
  player.px(x + 2, y + 15 - step, skin);
  player.px(x + 13, y + 15 + step, skin);
  // head outline + face
  player.rect(x + 3, y + 1, 10, 9, hair);
  player.rect(x + 4, y + 2, 8, 8, skin);
  if (dir === 'down') {
    player.rect(x + 4, y + 2, 8, 3, hair);
    player.rect(x + 3, y + 2, 2, 4, hair);
    player.rect(x + 11, y + 2, 2, 4, hair);
    player.px(x + 6, y + 6, P.black);
    player.px(x + 9, y + 6, P.black);
    player.rect(x + 7, y + 8, 2, 1, '#c97b5a');
  } else if (dir === 'up') {
    player.rect(x + 3, y + 1, 10, 9, hair);
    player.rect(x + 4, y + 2, 8, 1, hairLight);
    player.rect(x + 4, y + 8, 8, 2, skin);
  } else if (dir === 'left') {
    player.rect(x + 3, y + 1, 10, 4, hair);
    player.rect(x + 3, y + 2, 2, 7, hair);
    player.rect(x + 4, y + 4, 5, 5, skin);
    player.px(x + 5, y + 6, P.black);
    player.rect(x + 9, y + 8, 3, 1, '#c97b5a');
  } else {
    player.rect(x + 3, y + 1, 10, 4, hair);
    player.rect(x + 11, y + 2, 2, 7, hair);
    player.rect(x + 6, y + 4, 5, 5, skin);
    player.px(x + 9, y + 6, P.black);
    player.rect(x + 4, y + 8, 3, 1, '#c97b5a');
  }
}

for (let row = 0; row < 4; row++) {
  const dir = ['down', 'left', 'right', 'up'][row];
  for (let f = 0; f < 4; f++) charFrame(f * 16, row * 24, dir, f);
}
player.save(join(OUT, 'sprites', 'player.png'));

/* ---------- cats: 5 variants x 2 frames, 16x16 ---------- */
const CATS = [
  { main: '#e8943a', dark: '#b56a24', light: '#f6b968', patch: '#f6b968' },
  { main: '#3a3a46', dark: '#24242c', light: '#5a5a6a', patch: '#5a5a6a' },
  { main: '#e8e8e8', dark: '#b8b8b8', light: '#ffffff', patch: '#ffffff' },
  { main: '#e8d8c8', dark: '#8a5a3a', light: '#ffffff', patch: '#e8943a' },
  { main: '#9a9aa8', dark: '#6a6a78', light: '#c0c0cc', patch: '#c0c0cc' },
];
const cats = new Canvas(16 * 10, 16);
CATS.forEach((c, i) => {
  for (let f = 0; f < 2; f++) {
    const ox = (i * 2 + f) * 16;
    const bob = f;
    const outline = '#24242c';
    // tail
    if (f === 0) {
      cats.rect(ox + 12, 5 + bob, 2, 6, c.dark);
      cats.rect(ox + 13, 4 + bob, 2, 2, c.main);
    } else {
      cats.rect(ox + 12, 8 + bob, 3, 2, c.dark);
      cats.rect(ox + 14, 6 + bob, 2, 2, c.main);
    }
    // body
    cats.rect(ox + 4, 8 + bob, 8, 6, outline);
    cats.rect(ox + 5, 8 + bob, 6, 5, c.main);
    cats.rect(ox + 6, 10 + bob, 2, 2, c.patch);
    // legs
    cats.rect(ox + 5, 13 + bob, 2, 2, c.dark);
    cats.rect(ox + 10, 13 + bob, 2, 2, c.dark);
    // head
    cats.rect(ox + 2, 4 + bob, 7, 6, outline);
    cats.rect(ox + 3, 4 + bob, 5, 5, c.main);
    // ears
    cats.px(ox + 2, 2 + bob, outline);
    cats.px(ox + 3, 2 + bob, c.main);
    cats.px(ox + 2, 3 + bob, c.dark);
    cats.px(ox + 7, 2 + bob, outline);
    cats.px(ox + 7, 3 + bob, c.main);
    // face
    cats.px(ox + 4, 6 + bob, P.black);
    cats.px(ox + 7, 6 + bob, P.black);
    cats.px(ox + 5, 8 + bob, c.dark);
    cats.px(ox + 6, 8 + bob, c.dark);
    // chest
    cats.rect(ox + 5, 9 + bob, 2, 2, c.light);
  }
});
cats.save(join(OUT, 'sprites', 'cats.png'));

console.log('assets written to', OUT);
