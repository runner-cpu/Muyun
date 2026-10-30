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

/** 24x24 well: stone ring, two posts, pitched roof, bucket. */
function drawWell() {
  const c = new Canvas(24, 24);
  c.ellipse(12, 21, 9, 2.5, RAMP.dirt[0], 0.3);
  c.rect(4, 6, 2, 12, RAMP.dirt[3]);
  c.rect(18, 6, 2, 12, RAMP.dirt[3]);
  for (let y = 0; y <= 6; y++) {
    const half = y * 1.6;
    c.rect(12 - half, y + 1, half * 2, 1, RAMP.dirt[2]);
  }
  c.rect(3, 6, 18, 2, RAMP.dirt[3]);
  c.ellipse(12, 17, 8, 4, RAMP.stone[2]);
  c.ellipse(12, 16, 6.5, 3, RAMP.stone[3]);
  c.ellipse(12, 15.5, 5, 2, RAMP.water[1]);
  c.rect(10, 9, 4, 3, RAMP.dirt[1]);
  c.rect(10, 9, 4, 1, RAMP.dirt[4]);
  return c;
}

/** 24x16 stacked firewood. */
function drawWoodpile() {
  const c = new Canvas(24, 16);
  c.ellipse(12, 14.5, 10, 2, RAMP.dirt[0], 0.3);
  for (const [x, n] of [[4, 3], [10, 3], [16, 2]]) {
    for (let i = 0; i < n; i++) {
      const y = 11 - i * 4;
      c.rect(x, y, 6, 3, RAMP.dirt[3]);
      c.circle(x + 1, y + 1, 1, RAMP.dirt[6]);
      c.rect(x, y + 3, 6, 1, RAMP.dirt[1]);
    }
  }
  return c;
}

/** 32x24 hand cart. */
function drawCart() {
  const c = new Canvas(32, 24);
  c.ellipse(16, 21, 12, 2.5, RAMP.dirt[0], 0.3);
  c.circle(8, 18, 4, RAMP.dirt[1]);
  c.circle(8, 18, 2, RAMP.dirt[3]);
  c.circle(24, 18, 4, RAMP.dirt[1]);
  c.circle(24, 18, 2, RAMP.dirt[3]);
  c.rect(3, 8, 26, 7, RAMP.dirt[4]);
  c.rect(3, 8, 26, 1, RAMP.dirt[6]);
  c.rect(3, 14, 26, 1, RAMP.dirt[2]);
  for (let x = 5; x < 28; x += 4) c.rect(x, 9, 1, 5, RAMP.dirt[3]);
  c.rect(0, 10, 4, 2, RAMP.dirt[2]);
  return c;
}

/** 24x24 laundry line. */
function drawLaundry() {
  const c = new Canvas(24, 24);
  c.ellipse(12, 22, 9, 2, RAMP.dirt[0], 0.3);
  c.rect(2, 4, 2, 18, RAMP.dirt[3]);
  c.rect(20, 4, 2, 18, RAMP.dirt[3]);
  c.rect(3, 6, 18, 1, ACCENT.cream);
  c.rect(5, 7, 5, 7, ACCENT.cream);
  c.rect(5, 7, 5, 1, RAMP.dirt[5]);
  c.rect(11, 7, 4, 6, RAMP.water[4]);
  c.rect(16, 7, 3, 5, ACCENT.warm);
  return c;
}

function write(name, canvas) {
  const path = join(ROOT, `client/public/assets/structures/${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, canvas.toPng());
  return path;
}

console.log('structures:', [
  write('barn', drawBarn()),
  write('sign', drawSign()),
  write('well', drawWell()),
  write('woodpile', drawWoodpile()),
  write('cart', drawCart()),
  write('laundry', drawLaundry()),
].map((p) => p.replace(ROOT, '.')).join(', '));
