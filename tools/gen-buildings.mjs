import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'client', 'public', 'assets', 'buildings');
const DEFS = JSON.parse(readFileSync(join(ROOT, 'client', 'src', 'data', 'buildings.json'), 'utf8'));

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function color(hex, alpha = 255) { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), alpha]; }
class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.data = Buffer.alloc(w * h * 4); }
  px(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4; const rgba = typeof c === 'string' ? color(c) : c; if (rgba[3] === 255) { this.data[i] = rgba[0]; this.data[i + 1] = rgba[1]; this.data[i + 2] = rgba[2]; this.data[i + 3] = 255; return; } const a = rgba[3] / 255; const da = this.data[i + 3] / 255; const oa = a + da * (1 - a); if (!oa) return; this.data[i] = Math.round((rgba[0] * a + this.data[i] * da * (1 - a)) / oa); this.data[i + 1] = Math.round((rgba[1] * a + this.data[i + 1] * da * (1 - a)) / oa); this.data[i + 2] = Math.round((rgba[2] * a + this.data[i + 2] * da * (1 - a)) / oa); this.data[i + 3] = Math.round(oa * 255); }
  rect(x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c); }
  circle(cx, cy, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c); }
  ellipse(cx, cy, rx, ry, c) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, c); }
  save(path) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, encodePng(this.w, this.h, this.data)); }
}
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const PALETTES = {
  academic: [
    { wall: '#d8d1c1', trim: '#eee7d6', accent: '#a84f3f', base: '#675e53' },
    { wall: '#cfc8b8', trim: '#e7dfcd', accent: '#3d6e8c', base: '#5e574c' },
    { wall: '#ded7c7', trim: '#f0e9d8', accent: '#8c6a3b', base: '#6b6255' },
    { wall: '#c9c3b6', trim: '#e3dbca', accent: '#4e7a61', base: '#5a5449' },
  ],
  lab: [
    { wall: '#b8bdc3', trim: '#d8dde1', accent: '#3d6e8c', base: '#5b6168' },
    { wall: '#c4c8cc', trim: '#e0e4e7', accent: '#8c4b3e', base: '#60666d' },
    { wall: '#adb4bb', trim: '#d1d7dc', accent: '#396b7e', base: '#555b62' },
    { wall: '#bcc1c6', trim: '#dde2e6', accent: '#7a5c3d', base: '#5e646a' },
  ],
  dorm: [
    { wall: '#d2d0cc', trim: '#e9e6df', accent: '#3e6f8a', base: '#7a5145' },
    { wall: '#c7c3bc', trim: '#e0dcd2', accent: '#446f84', base: '#805547' },
    { wall: '#d8d4cd', trim: '#eee9df', accent: '#39657d', base: '#745044' },
  ],
  library: [{ wall: '#ded4bd', trim: '#f1e8d4', accent: '#96723f', base: '#6b5d48' }],
  sports: [{ wall: '#d9dde0', trim: '#f2f4f4', accent: '#3b6d8a', base: '#5a6067' }],
  activity: [{ wall: '#d8cec0', trim: '#eee4d4', accent: '#3c7a86', base: '#675d50' }],
  canteen: [{ wall: '#e0cdb0', trim: '#f0e1c8', accent: '#a84537', base: '#71583e' }],
  gate: [{ wall: '#a85a45', trim: '#e8ddc8', accent: '#3d6e8c', base: '#6e3c30' }],
};
const WINDOW = { frame: '#263b4b', glass: '#3b6f8a', light: '#8fc3d4', deep: '#2b5369' };
const ROOF = { top: '#666c73', light: '#8e949a', dark: '#4a4f56', trim: '#a8adb2' };

function drawRoof(c, x, y, w, h, type, r) {
  if (type === 'sports') {
    c.rect(x, y, w, h, '#d9dde0');
    c.ellipse(x + w / 2, y + h * 0.55, w * 0.45, h * 0.62, '#eceeee');
    c.ellipse(x + w / 2, y + h * 0.45, w * 0.42, h * 0.5, '#f4f5f4');
    c.rect(x, y + h - 4, w, 4, '#aab0b5');
    return;
  }
  // 3/4 roof: narrow at the back, full footprint at the eave
  const slope = Math.min(12, Math.max(5, Math.round(w * 0.04)));
  for (let yy = 0; yy < h; yy++) {
    const inset = Math.round(((h - 1 - yy) / Math.max(1, h - 1)) * slope);
    c.rect(x + inset, y + yy, w - inset * 2, 1, ROOF.top);
    if (yy === 0) c.rect(x + inset, y + yy, w - inset * 2, 2, ROOF.light);
    if (yy === h - 1) c.rect(x, y + yy, w, 2, ROOF.dark);
    c.px(x + inset, y + yy, ROOF.dark);
    c.px(x + w - inset - 1, y + yy, ROOF.dark);
  }
  // gravel / panel variation
  for (let i = 0; i < Math.max(50, w * h / 70); i++) {
    const px = x + 7 + Math.floor(r() * Math.max(1, w - 14));
    const py = y + 4 + Math.floor(r() * Math.max(1, h - 9));
    c.px(px, py, r() > 0.5 ? '#5e646c' : '#4a5058');
  }
  for (let xx = x + 9; xx < x + w - 4; xx += 13) c.rect(xx, y + 4, 1, Math.max(2, h - 10), '#4d535a');
  // parapet / rooftop trim
  c.rect(x + 6, y + 3, w - 12, 1, '#666c74');
  c.rect(x + 3, y + h - 8, w - 6, 1, '#444950');
  // rooftop equipment
  const count = 2 + Math.floor(r() * 3);
  for (let i = 0; i < count; i++) {
    const bw = 8 + Math.floor(r() * 16);
    const bh = 5 + Math.floor(r() * 8);
    const bx = x + 12 + Math.floor(r() * Math.max(1, w - bw - 24));
    const by = y + 5 + Math.floor(r() * Math.max(1, h - bh - 9));
    c.rect(bx, by, bw, bh, '#71777f');
    c.rect(bx, by, bw, 2, '#8b9198');
    c.rect(bx + 2, by + 2, Math.max(2, bw - 4), Math.max(1, bh - 3), '#555b62');
  }
  if (type === 'library') {
    c.rect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.32, '#5d8da0');
    c.rect(x + w * 0.2, y + h * 0.3, w * 0.6, 2, '#a8d0dc');
  }
}

function drawFloorLines(c, x, y, w, facadeH, groundH, floors) {
  c.rect(x, y + facadeH - groundH, w, groundH, '#5b554b');
  c.rect(x, y + facadeH - groundH, w, 2, '#867b6b');
  const usable = Math.max(12, facadeH - groundH - 6);
  const step = usable / Math.max(1, floors);
  for (let i = 0; i < floors; i++) {
    const yy = Math.round(y + i * step);
    c.rect(x + 2, yy, w - 4, 1, '#b9b1a1');
  }
  return step;
}

function drawWindows(c, x, y, w, facadeH, groundH, floors, type, r) {
  const rows = Math.max(2, Math.min(floors, Math.floor((facadeH - groundH - 4) / (type === 'dorm' ? 8 : 13))));
  const step = drawFloorLines(c, x, y, w, facadeH, groundH, rows);
  const usableH = facadeH - groundH - 4;
  const winH = Math.max(4, Math.min(11, Math.floor(usableH / Math.max(1, rows) - 3)));
  const margin = 8;
  if (type === 'lab') {
    for (let i = 0; i < rows; i++) {
      const yy = Math.round(y + i * step + 3);
      c.rect(x + margin, yy, w - margin * 2, winH, WINDOW.frame);
      c.rect(x + margin + 1, yy + 1, w - margin * 2 - 2, Math.max(2, winH - 2), WINDOW.glass);
      for (let xx = x + margin + 4; xx < x + w - margin - 2; xx += 10) c.rect(xx, yy + 1, 1, Math.max(2, winH - 2), '#5f8fa3');
      c.rect(x + margin + 1, yy + 1, w - margin * 2 - 2, 1, WINDOW.light);
    }
    return;
  }
  if (type === 'dorm') {
    for (let i = 0; i < rows; i++) {
      const yy = Math.round(y + i * step + 2);
      for (let xx = x + 8; xx < x + w - 10; xx += 22) {
        c.rect(xx, yy, 9, winH, WINDOW.frame);
        c.rect(xx + 1, yy + 1, 7, Math.max(2, winH - 2), WINDOW.glass);
        c.rect(xx + 1, yy + 2, 7, 1, WINDOW.light);
        c.rect(xx - 2, yy + winH, 13, 2, '#a6a19a');
      }
      c.rect(x + 5, yy + winH + 2, w - 10, 1, '#b8b2a9');
    }
    return;
  }
  if (type === 'activity') {
    c.rect(x + 4, y + 2, 8, facadeH - groundH - 4, '#3c7a86');
    c.rect(x + w - 12, y + 2, 8, facadeH - groundH - 4, '#c78a45');
    for (let i = 0; i < rows; i++) {
      const yy = Math.round(y + i * step + 3);
      for (let xx = x + 16; xx < x + w - 16; xx += 18) {
        c.rect(xx, yy, 12, winH, WINDOW.frame);
        c.rect(xx + 1, yy + 1, 10, Math.max(2, winH - 2), WINDOW.glass);
        c.rect(xx + 1, yy + 1, 10, 1, WINDOW.light);
      }
    }
    return;
  }
  if (type === 'library') {
    for (let i = 0; i < rows; i++) {
      const yy = Math.round(y + i * step + 3);
      for (let xx = x + 6; xx < x + w - 6; xx += 16) {
        if (xx > x + w * 0.32 && xx < x + w * 0.68) continue;
        c.rect(xx, yy, 9, winH, WINDOW.frame);
        c.rect(xx + 1, yy + 1, 7, Math.max(2, winH - 2), WINDOW.glass);
        c.rect(xx + 1, yy + 1, 7, 1, WINDOW.light);
      }
    }
    return;
  }
  for (let i = 0; i < rows; i++) {
    const yy = Math.round(y + i * step + 3);
    for (let xx = x + 8; xx < x + w - 10; xx += 18) {
      c.rect(xx, yy, 12, winH, WINDOW.frame);
      c.rect(xx + 1, yy + 1, 10, Math.max(2, winH - 2), WINDOW.glass);
      c.rect(xx + 1, yy + 1, 10, 1, WINDOW.light);
      c.rect(xx + 5, yy + 1, 1, Math.max(2, winH - 2), '#5d8da0');
    }
  }
}

function drawSideWall(c, x, w, y, h, palette) {
  c.rect(x + w - 5, y, 5, h, palette.base);
  c.rect(x + w - 6, y, 1, h, '#a89f90');
  c.rect(x + w - 5, y, 5, 2, '#8f8678');
}

function drawEntrance(c, x, y, w, facadeH, type, accent) {
  const doorW = Math.min(54, Math.max(24, Math.round(w * 0.18)));
  const doorH = Math.min(34, Math.max(18, Math.round(facadeH * 0.24)));
  const dx = x + Math.round((w - doorW) / 2);
  const dy = y + facadeH - doorH;
  c.rect(dx - 4, dy - 5, doorW + 8, 5, accent);
  c.rect(dx - 4, dy - 5, doorW + 8, 2, '#f0e5cf');
  c.rect(dx, dy, doorW, doorH, '#263c4a');
  c.rect(dx + 2, dy + 2, doorW - 4, doorH - 4, '#31576a');
  c.rect(dx + Math.floor(doorW / 2), dy + 2, 1, doorH - 4, '#7fa8b6');
  c.rect(dx + 2, dy + 3, doorW - 4, 2, '#9ac6d2');
  c.rect(dx - 3, y + facadeH - 3, doorW + 6, 3, '#d7cdbb');
  if (type === 'canteen') {
    for (let xx = dx - 8; xx < dx + doorW + 8; xx += 6) c.rect(xx, dy - 10, 6, 6, accent);
  }
}

function drawBuilding(def) {
  const pad = 4;
  const bodyW = def.w * 16;
  const bodyH = def.h * 16;
  const c = new Canvas(bodyW + 8, bodyH + 8);
  const r = rng(hash(def.key));
  const palette = (PALETTES[def.type] ?? PALETTES.academic)[def.variant % (PALETTES[def.type] ?? PALETTES.academic).length];
  c.rect(pad + 5, pad + 6, bodyW, bodyH, [0, 0, 0, 55]);
  c.rect(pad, pad, bodyW, bodyH, palette.wall);
  c.rect(pad + bodyW - 5, pad, 5, bodyH, palette.base);
  const roofRatio = def.type === 'gate' ? 0.42 : def.type === 'dorm' ? 0.3 : def.type === 'sports' ? 0.34 : 0.46;
  const roofH = Math.max(20, Math.round(bodyH * roofRatio));
  drawRoof(c, pad - 3, pad - 2, bodyW + 6, roofH + 4, def.type, r);
  c.rect(pad, pad + roofH + 1, bodyW, 3, [0, 0, 0, 45]);
  const facadeH = bodyH - roofH - 2;
  const facadeY = pad + roofH + 2;
  if (def.type === 'gate') {
    c.rect(pad + 2, facadeY, bodyW - 4, facadeH, palette.wall);
    c.rect(pad + 7, facadeY + 4, bodyW - 14, facadeH - 7, '#31576a');
    c.rect(pad + 9, facadeY + 6, bodyW - 18, 2, '#8fc3d4');
    c.rect(pad + 4, facadeY + facadeH - 4, bodyW - 8, 4, palette.base);
    return c;
  }
  if (def.type === 'sports') {
    c.rect(pad, facadeY, bodyW, facadeH, palette.wall);
    c.rect(pad + 4, facadeY + 8, bodyW - 8, Math.min(30, facadeH - 24), '#3d6e8a');
    c.rect(pad + 4, facadeY + 8, bodyW - 8, 3, '#9bc6d8');
    for (let xx = pad + 10; xx < pad + bodyW - 8; xx += 16) c.rect(xx, facadeY + 12, 1, Math.min(24, facadeH - 30), '#7fa8b6');
    drawEntrance(c, pad, facadeY, bodyW, facadeH, def.type, palette.accent);
    drawSideWall(c, pad, bodyW, facadeY, facadeH, palette);
    return c;
  }
  if (def.type === 'library') {
    drawWindows(c, pad, facadeY, bodyW, facadeH, 18, def.floors, 'library', r);
    // central glass atrium
    const aw = Math.min(74, Math.round(bodyW * 0.28));
    const ax = pad + Math.round((bodyW - aw) / 2);
    c.rect(ax - 2, facadeY + 2, aw + 4, facadeH - 20, '#e8dfcc');
    c.rect(ax, facadeY + 4, aw, facadeH - 24, '#2f5365');
    c.rect(ax + 2, facadeY + 6, aw - 4, facadeH - 28, '#4f849b');
    for (let xx = ax + 6; xx < ax + aw - 2; xx += 9) c.rect(xx, facadeY + 6, 1, facadeH - 28, '#8dbbc8');
    c.rect(ax + 2, facadeY + 6, aw - 4, 3, '#b9d8e1');
    drawEntrance(c, pad, facadeY, bodyW, facadeH, def.type, palette.accent);
    drawSideWall(c, pad, bodyW, facadeY, facadeH, palette);
    return c;
  }
  if (def.type === 'dorm') {
    drawWindows(c, pad, facadeY, bodyW, facadeH, 16, def.floors, 'dorm', r);
    // brick base
    c.rect(pad, facadeY + facadeH - 15, bodyW, 15, palette.base);
    c.rect(pad, facadeY + facadeH - 15, bodyW, 2, '#a06a55');
    drawEntrance(c, pad, facadeY, bodyW, facadeH, def.type, palette.accent);
    drawSideWall(c, pad, bodyW, facadeY, facadeH, palette);
    return c;
  }
  if (def.type === 'canteen') {
    drawWindows(c, pad, facadeY, bodyW, facadeH, 18, 2, 'academic', r);
    const ax = pad + 4;
    const aw = bodyW - 8;
    const ay = facadeY + facadeH - 26;
    for (let xx = ax; xx < ax + aw; xx += 6) c.rect(xx, ay, 6, 7, palette.accent);
    c.rect(ax, ay + 7, aw, 2, '#7a342d');
    c.rect(ax + 8, facadeY + 10, aw - 16, 16, '#3b6f8a');
    c.rect(ax + 8, facadeY + 10, aw - 16, 2, '#a4cfda');
    drawEntrance(c, pad, facadeY, bodyW, facadeH, def.type, palette.accent);
    drawSideWall(c, pad, bodyW, facadeY, facadeH, palette);
    return c;
  }
  drawWindows(c, pad, facadeY, bodyW, facadeH, def.type === 'activity' ? 16 : 14, def.floors, def.type, r);
  drawEntrance(c, pad, facadeY, bodyW, facadeH, def.type, palette.accent);
  drawSideWall(c, pad, bodyW, facadeY, facadeH, palette);
  return c;
}

mkdirSync(OUT, { recursive: true });
for (const def of DEFS) {
  const c = drawBuilding(def);
  c.save(join(OUT, `${def.key}.png`));
}
console.log('generated', DEFS.length, 'building sprites to', OUT);
