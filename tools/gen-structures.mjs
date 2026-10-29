import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas } from './lib/pixel.mjs';
import { ACCENT, RAMP } from './theme.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 48x56 barn: 3/4 view, roof takes ~55% of the height, shadow baked at the base. */
function drawBarn() {
  const W = 48;
  const H = 56;
  const c = new Canvas(W, H);

  c.ellipse(24, 53, 20, 4, RAMP.dirt[0], 0.3);

  // wall
  c.rect(4, 28, 40, 24, RAMP.dirt[4]);
  c.rect(4, 28, 40, 2, RAMP.dirt[6]);
  c.rect(4, 50, 40, 2, RAMP.dirt[2]);
  for (let x = 4; x < 44; x += 4) c.rect(x, 30, 1, 20, RAMP.dirt[3]);

  // roof triangle
  for (let y = 6; y <= 30; y++) {
    const half = y - 6;
    c.rect(24 - half, y, half * 2, 1, RAMP.dirt[2]);
  }
  for (let y = 10; y <= 28; y += 4) {
    const half = y - 6;
    c.rect(24 - half, y, half * 2, 1, RAMP.dirt[1]);
  }
  c.rect(0, 28, 48, 4, RAMP.dirt[3]);
  c.rect(0, 31, 48, 1, RAMP.dirt[1]);

  // gable trim
  c.rect(22, 6, 4, 2, RAMP.dirt[5]);
  c.rect(2, 28, 44, 1, ACCENT.cream, 0.35);

  // door
  c.rect(19, 37, 10, 15, RAMP.dirt[1]);
  c.rect(19, 37, 10, 1, RAMP.dirt[3]);
  c.rect(23, 38, 1, 14, RAMP.dirt[0]);
  c.rect(20, 44, 8, 1, RAMP.dirt[0]);

  // window
  c.rect(9, 34, 8, 8, ACCENT.cream);
  c.rect(10, 35, 6, 6, RAMP.water[2]);
  c.rect(12, 35, 1, 6, ACCENT.cream);
  c.rect(10, 38, 6, 1, ACCENT.cream);

  // hay loft
  c.rect(20, 18, 8, 8, RAMP.dirt[1]);
  c.rect(20, 18, 8, 1, RAMP.dirt[3]);

  return c;
}

/** 16x16 signpost, used as a scene anchor. */
function drawSign() {
  const c = new Canvas(16, 16);
  c.ellipse(8, 14, 4, 1, RAMP.dirt[0], 0.3);
  c.rect(7, 6, 2, 8, RAMP.dirt[2]);
  c.rect(2, 2, 12, 6, RAMP.dirt[4]);
  c.rect(2, 2, 12, 1, RAMP.dirt[6]);
  c.rect(2, 7, 12, 1, RAMP.dirt[1]);
  c.rect(4, 4, 8, 1, RAMP.dirt[2]);
  c.rect(4, 6, 5, 1, RAMP.dirt[2]);
  return c;
}

function write(name, canvas) {
  const path = join(ROOT, `client/public/assets/structures/${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, canvas.toPng());
  return path;
}

console.log('structures:', [write('barn', drawBarn()), write('sign', drawSign())]
  .map((p) => p.replace(ROOT, '.')).join(', '));
