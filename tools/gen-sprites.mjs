import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas } from './lib/pixel.mjs';
import { ACCENT, RAMP } from './theme.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SKIN = '#C99B6E';
const SKIN_SHADE = '#A37F4E';
const HAIR = RAMP.dirt[0];
const COAT = RAMP.water[3];
const COAT_DARK = RAMP.water[1];
const COAT_LIGHT = RAMP.water[5];
const PANTS = RAMP.dirt[2];
const BOOT = RAMP.dirt[0];
const HAT = RAMP.dirt[5];
const HAT_DARK = RAMP.dirt[3];

const YAK = { body: RAMP.dirt[3], mid: RAMP.dirt[1], light: RAMP.dirt[4], horn: ACCENT.cream, hoof: '#14100C' };
const SHEEP = { wool: ACCENT.cream, woolShade: RAMP.dirt[5], woolLight: ACCENT.white, face: RAMP.dirt[0], hoof: '#14100C' };

const DIRS = ['down', 'left', 'right', 'up'];

/** 24x32 herder: hat, coat, four-frame walk, bob on the pass frames. */
function drawPerson(canvas, ox, oy, dir, frame) {
  const bob = frame === 1 || frame === 3 ? 1 : 0;
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;

  canvas.ellipse(ox + 12, oy + 30, 7, 2.2, '#2E2118', 0.3);

  canvas.rect(ox + 8 + swing, oy + 23, 3, 6, PANTS);
  canvas.rect(ox + 13 - swing, oy + 23, 3, 6, PANTS);
  canvas.rect(ox + 8 + swing, oy + 28, 3, 3, BOOT);
  canvas.rect(ox + 13 - swing, oy + 28, 3, 3, BOOT);

  canvas.rect(ox + 7, oy + 12 + bob, 10, 12, COAT);
  canvas.rect(ox + 7, oy + 12 + bob, 10, 1, COAT_LIGHT);
  canvas.rect(ox + 7, oy + 23 + bob, 10, 1, COAT_DARK);
  canvas.rect(ox + 11, oy + 12 + bob, 1, 12, COAT_DARK);

  const armSwing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  canvas.rect(ox + 5, oy + 14 + bob + armSwing, 2, 8, COAT_DARK);
  canvas.rect(ox + 17, oy + 14 + bob - armSwing, 2, 8, COAT_DARK);

  canvas.circle(ox + 12, oy + 9 + bob, 5, SKIN);
  canvas.ellipse(ox + 12, oy + 11 + bob, 4, 2, SKIN_SHADE, 0.5);

  canvas.rect(ox + 6, oy + 3 + bob, 13, 2, HAT_DARK);
  canvas.rect(ox + 8, oy + 0 + bob, 8, 4, HAT);
  canvas.rect(ox + 8, oy + 0 + bob, 8, 1, RAMP.dirt[6]);
  canvas.rect(ox + 8, oy + 3 + bob, 8, 1, HAT_DARK);

  if (dir === 'down') {
    canvas.px(ox + 10, oy + 9 + bob, HAIR);
    canvas.px(ox + 14, oy + 9 + bob, HAIR);
    canvas.rect(ox + 11, oy + 12 + bob, 3, 1, SKIN_SHADE);
  } else if (dir === 'left') {
    canvas.px(ox + 9, oy + 9 + bob, HAIR);
    canvas.rect(ox + 6, oy + 9 + bob, 2, 2, SKIN);
  } else if (dir === 'right') {
    canvas.px(ox + 15, oy + 9 + bob, HAIR);
    canvas.rect(ox + 16, oy + 9 + bob, 2, 2, SKIN);
  } else {
    canvas.rect(ox + 8, oy + 5 + bob, 8, 5, HAIR);
  }
}

/** 32x32 yak: dark outline, lighter body, hump, cream horns, four-frame plod. */
function drawYak(canvas, ox, oy, dir, frame) {
  const bob = frame === 1 || frame === 3 ? 1 : 0;
  const swing = frame === 1 ? 2 : frame === 3 ? -2 : 0;
  const cx = ox + 16;
  const cy = oy + 15 + bob;

  canvas.ellipse(cx, oy + 28, 9, 3, '#2E2118', 0.32);

  if (dir !== 'up') {
    canvas.rect(cx - 7 + swing, cy + 7, 2, 4, YAK.mid);
    canvas.rect(cx + 5 - swing, cy + 7, 2, 4, YAK.mid);
    canvas.rect(cx - 7 + swing, cy + 10, 2, 1, YAK.hoof);
    canvas.rect(cx + 5 - swing, cy + 10, 2, 1, YAK.hoof);
  }

  canvas.circle(cx, cy - 6, 6, YAK.mid);
  canvas.circle(cx, cy - 6, 5, YAK.body);
  canvas.ellipse(cx, cy, 10.5, 7, YAK.mid);
  canvas.ellipse(cx, cy, 9, 5.5, YAK.body);
  canvas.ellipse(cx - 2, cy - 2, 5, 3, YAK.light, 0.35);
  canvas.ellipse(cx, cy + 5, 8, 1.5, YAK.mid, 0.6);

  if (dir === 'up') {
    canvas.rect(cx - 2, cy + 6, 4, 1, YAK.mid);
    canvas.rect(cx - 1, cy + 7, 2, 4, YAK.body);
    return;
  }

  let hx = cx;
  let hy = cy + 8;
  if (dir === 'left') { hx = cx - 11; hy = cy + 1; }
  if (dir === 'right') { hx = cx + 11; hy = cy + 1; }

  canvas.rect(hx - 7, hy - 4, 3, 2, YAK.horn);
  canvas.rect(hx + 5, hy - 4, 3, 2, YAK.horn);
  canvas.rect(hx - 8, hy - 6, 2, 3, YAK.horn);
  canvas.rect(hx + 7, hy - 6, 2, 3, YAK.horn);

  canvas.circle(hx, hy, 5, YAK.mid);
  canvas.circle(hx, hy, 4, YAK.body);
  canvas.ellipse(hx, hy + 2, 2.5, 1.5, YAK.light, 0.6);
  if (dir === 'down') {
    canvas.px(hx - 2, hy - 1, ACCENT.white);
    canvas.px(hx + 2, hy - 1, ACCENT.white);
  } else {
    canvas.px(hx + (dir === 'left' ? -2 : 2), hy - 1, ACCENT.white);
  }
}

/** 32x32 sheep: three wool lobes, dark face, thin legs. */
function drawSheep(canvas, ox, oy, dir, frame) {
  const bob = frame === 1 || frame === 3 ? 1 : 0;
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const cx = ox + 16;
  const cy = oy + 18 + bob;

  canvas.ellipse(cx, oy + 28, 8, 2.6, '#2E2118', 0.3);

  canvas.rect(cx - 5 + swing, cy + 5, 2, 4, SHEEP.face);
  canvas.rect(cx + 3 - swing, cy + 5, 2, 4, SHEEP.face);
  canvas.rect(cx - 5 + swing, cy + 8, 2, 1, SHEEP.hoof);
  canvas.rect(cx + 3 - swing, cy + 8, 2, 1, SHEEP.hoof);

  canvas.circle(cx - 5, cy - 2, 6, SHEEP.woolShade);
  canvas.circle(cx + 5, cy - 2, 6, SHEEP.woolShade);
  canvas.circle(cx, cy - 5, 7, SHEEP.wool);
  canvas.circle(cx - 3, cy - 2, 4, SHEEP.woolLight, 0.55);
  canvas.circle(cx + 4, cy - 1, 3, SHEEP.woolLight, 0.35);

  let hx = cx;
  let hy = cy + 5;
  if (dir === 'left') { hx = cx - 9; hy = cy + 1; }
  if (dir === 'right') { hx = cx + 9; hy = cy + 1; }
  if (dir === 'up') {
    canvas.circle(cx, cy - 2, 5, SHEEP.woolShade);
    canvas.rect(cx - 1, cy + 6, 2, 3, SHEEP.face);
    return;
  }

  canvas.circle(hx, hy, 3.5, SHEEP.face);
  canvas.ellipse(hx, hy - 3, 3, 2, SHEEP.woolShade);
  canvas.px(hx + (dir === 'left' ? -2 : 2), hy - 1, ACCENT.white);
}

function makeSheet(frameW, frameH, draw) {
  const sheet = new Canvas(frameW * 4, frameH * 4);
  DIRS.forEach((dir, row) => {
    for (let frame = 0; frame < 4; frame++) {
      draw(sheet, frame * frameW, row * frameH, dir, frame);
    }
  });
  return sheet;
}

function write(name, sheet) {
  const path = join(ROOT, `client/public/assets/sprites/${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, sheet.toPng());
  return path;
}

const outputs = [
  write('player', makeSheet(24, 32, drawPerson)),
  write('yak', makeSheet(32, 32, drawYak)),
  write('sheep', makeSheet(32, 32, drawSheep)),
];

console.log('sprites:', outputs.map((p) => p.replace(ROOT, '.')).join(', '));
