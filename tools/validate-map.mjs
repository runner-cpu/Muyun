import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(readFileSync(join(ROOT, 'maps', 'campus.tmj'), 'utf8'));
const W = map.width;
const H = map.height;
const layer = (name) => map.layers.find((l) => l.name === name);
const ground = layer('ground').data;
const collision = layer('collision').data;
const triggers = layer('triggers').objects;
const tileAt = (data, tx, ty) => data[ty * W + tx] ?? 0;
const walkable = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && tileAt(collision, tx, ty) === 0;
const issues = [];
const warnings = [];

const ids = new Set();
for (const obj of triggers) {
  const props = Object.fromEntries((obj.properties ?? []).map((p) => [p.name, p.value]));
  const tx = Math.floor(obj.x / 16);
  const ty = Math.floor(obj.y / 16);
  if (ids.has(props.id)) issues.push(`duplicate trigger id ${props.id}`);
  ids.add(props.id);
  if (!walkable(tx, ty)) issues.push(`trigger ${props.id} is on a solid tile at ${tx},${ty}`);
  if (!props.label) warnings.push(`trigger ${props.id} has no label`);
}

// Reachability sanity: flood fill from spawn over walkable tiles.
const spawn = { x: 71, y: 11 };
const seen = new Set();
const queue = [[spawn.x, spawn.y]];
while (queue.length) {
  const [x, y] = queue.pop();
  const key = `${x},${y}`;
  if (seen.has(key) || !walkable(x, y)) continue;
  seen.add(key);
  queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}
for (const obj of triggers) {
  const props = Object.fromEntries((obj.properties ?? []).map((p) => [p.name, p.value]));
  const tx = Math.floor(obj.x / 16);
  const ty = Math.floor(obj.y / 16);
  if (walkable(tx, ty) && !seen.has(`${tx},${ty}`)) warnings.push(`trigger ${props.id} is walkable but isolated at ${tx},${ty}`);
}

console.log(`map ${W}x${H}, triggers ${triggers.length}, walkable tiles ${seen.size}`);
console.log(`issues: ${issues.length}`);
for (const issue of issues) console.log('  ✗', issue);
console.log(`warnings: ${warnings.length}`);
for (const warning of warnings) console.log('  !', warning);
if (issues.length) process.exitCode = 1;
