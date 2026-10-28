import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'client', 'public', 'assets', 'trees');
const TREES = JSON.parse(readFileSync(join(ROOT, 'client', 'src', 'data', 'trees.json'), 'utf8'));

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
function encodePng(width, height, rgba) { const stride = width * 4; const raw = Buffer.alloc((stride + 1) * height); for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); } const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }
function color(hex, alpha = 255) { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), alpha]; }
class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.data = Buffer.alloc(w * h * 4); }
  px(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4; const rgba = typeof c === 'string' ? color(c) : c; if (rgba[3] === 255) { this.data[i] = rgba[0]; this.data[i + 1] = rgba[1]; this.data[i + 2] = rgba[2]; this.data[i + 3] = 255; return; } const a = rgba[3] / 255; const da = this.data[i + 3] / 255; const oa = a + da * (1 - a); if (!oa) return; this.data[i] = Math.round((rgba[0] * a + this.data[i] * da * (1 - a)) / oa); this.data[i + 1] = Math.round((rgba[1] * a + this.data[i + 1] * da * (1 - a)) / oa); this.data[i + 2] = Math.round((rgba[2] * a + this.data[i + 2] * da * (1 - a)) / oa); this.data[i + 3] = Math.round(oa * 255); }
  rect(x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c); }
  circle(cx, cy, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c); }
  ellipse(cx, cy, rx, ry, c) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, c); }
  save(path) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, encodePng(this.w, this.h, this.data)); }
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const GREENS = [
  ['#2f5e2e', '#3f7d3c', '#5aa34a', '#79bd5b'],
  ['#28552e', '#356b37', '#4f8e43', '#6eaf54'],
  ['#365f2d', '#477a36', '#5f9a45', '#82b95a'],
];

function drawTree(variant) {
  const c = new Canvas(32, 44);
  const r = rng(100 + variant * 31);
  const g = GREENS[variant % GREENS.length];
  c.ellipse(16, 40, 13, 4, [0, 0, 0, 60]);
  // trunk
  c.rect(14, 27, 4, 14, '#4b3322');
  c.rect(15, 27, 2, 14, '#6b4a2f');
  c.rect(16, 37, 5, 3, '#4b3322');
  // canopy silhouette
  if (variant === 0) {
    c.circle(16, 15, 13, g[0]);
    c.circle(10, 18, 9, g[0]);
    c.circle(23, 18, 9, g[0]);
  } else if (variant === 1) {
    c.ellipse(16, 17, 12, 14, g[0]);
    c.circle(9, 19, 8, g[0]);
    c.circle(23, 19, 8, g[0]);
  } else {
    c.circle(16, 12, 12, g[0]);
    c.circle(11, 17, 9, g[0]);
    c.circle(21, 17, 9, g[0]);
    c.circle(16, 22, 8, g[0]);
  }
  // mid tones
  c.circle(15, 14, 10, g[1]);
  c.circle(10, 17, 7, g[1]);
  c.circle(22, 17, 7, g[1]);
  c.circle(16, 21, 6, g[1]);
  // highlights
  c.circle(11, 11, 5, g[2]);
  c.circle(20, 12, 4, g[2]);
  c.circle(16, 17, 3, g[2]);
  // light pixels
  for (let i = 0; i < 16; i++) c.px(5 + (r() * 23 | 0), 5 + (r() * 18 | 0), g[3]);
  // leaf clusters
  for (let i = 0; i < 22; i++) c.px(3 + (r() * 27 | 0), 4 + (r() * 24 | 0), g[1]);
  return c;
}

mkdirSync(OUT, { recursive: true });
for (let v = 0; v < 3; v++) drawTree(v).save(join(OUT, `tree_${v}.png`));
console.log('generated trees for', TREES.length, 'placements');
