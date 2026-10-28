import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = JSON.parse(readFileSync(join(ROOT, 'maps', 'qhu-buildings.geojson'), 'utf8'));
const W = 180;
const H = 110;

const G = {
  GRASS: 1, FLOWER: 2, PATH: 3, PLAZA: 4, ROAD: 5, ROADLINE: 6,
  WATER: 7, WATERDARK: 8, WALL: 9, WALL_BRICK: 10, WINDOW: 11, DOOR: 12,
  ROOF: 13, ROOF_RIDGE: 14, STEPS: 15, TREE: 16, TRUNK: 17, HEDGE: 18,
  TRACK: 19, TRACKLINE: 20, COURT: 21, COURTLINE: 22, BENCH: 23, LAMP: 24,
  FLOWERBED: 25, FOUNTAIN: 26, FENCE: 27, SIGN: 28, ROOF_EDGE: 29, SHADOW: 30, SOLID: 31,
  GRASS2: 33, GRASS3: 34, TRACK_BLUE: 35, TRACK_BLUE_LINE: 36, ROADLINE_V: 37,
};

const empty = () => new Array(W * H).fill(0);
const layers = { ground: empty(), detail: empty(), shadows: empty(), buildings: empty(), props: empty(), collision: empty() };
const at = (x, y) => y * W + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const set = (layer, x, y, v) => { if (inMap(x, y)) layers[layer][at(x, y)] = v; };
const rect = (layer, x, y, w, h, v) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(layer, xx, yy, v); };

function allRings(feature) {
  const rings = [];
  for (const polygon of feature.geometry.coordinates) {
    if (!Array.isArray(polygon)) continue;
    if (Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
      for (const ring of polygon) if (ring.length >= 3) rings.push(ring);
    } else if (polygon.length >= 3) rings.push(polygon);
  }
  return rings;
}
function ringBBox(ring) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of ring) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
function largestRing(feature) {
  let best = null;
  for (const ring of allRings(feature)) {
    const b = ringBBox(ring);
    if (!best || b.w * b.h > best.b.w * best.b.h) best = { ring, b };
  }
  return best;
}

let minLng = Infinity; let maxLng = -Infinity; let minLat = Infinity; let maxLat = -Infinity;
for (const f of GEO.features) {
  const name = f.properties?.name;
  if (!name || name === '未知') continue;
  for (const ring of allRings(f)) {
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
  }
}
const mx = (maxLng - minLng) * 0.04; const my = (maxLat - minLat) * 0.04;
minLng -= mx; maxLng += mx; minLat -= my; maxLat += my;

const toTileX = (lng) => ((lng - minLng) / (maxLng - minLng)) * (W - 1);
const toTileY = (lat) => ((maxLat - lat) / (maxLat - minLat)) * (H - 1);
const toLngLat = (tx, ty) => [minLng + (tx / (W - 1)) * (maxLng - minLng), maxLat - (ty / (H - 1)) * (maxLat - minLat)];

function pointInRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const rand = rng(8765);

// base grass, with three tones
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const r = rand();
  set('ground', x, y, r < 0.22 ? G.GRASS2 : r > 0.78 ? G.GRASS3 : G.GRASS);
}

// campus roads: a rotated-ish grid, cut into the green
const ROAD_SPACING_X = 20;
const ROAD_SPACING_Y = 16;
const ROAD_ANGLE = (15 * Math.PI) / 180;
const cosA = Math.cos(ROAD_ANGLE); const sinA = Math.sin(ROAD_ANGLE);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const u = x * cosA + y * sinA;
  const v = -x * sinA + y * cosA;
  const rx = ((u % ROAD_SPACING_X) + ROAD_SPACING_X) % ROAD_SPACING_X;
  const ry = ((v % ROAD_SPACING_Y) + ROAD_SPACING_Y) % ROAD_SPACING_Y;
  if (rx < 2 || ry < 2) set('ground', x, y, G.ROAD);
  else if (rx < 3 || ry < 3) set('ground', x, y, G.PATH);
}
// subtle dashed lane detail along the rotated roads
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (layers.ground[at(x, y)] !== G.ROAD) continue;
  const u = x * cosA + y * sinA;
  const v = -x * sinA + y * cosA;
  if (Math.abs((((u % 20) + 20) % 20) - 1) < 0.35 && Math.abs((((v % 16) + 16) % 16) - 8) < 3) set('detail', x, y, G.ROADLINE_V);
  if (Math.abs((((v % 16) + 16) % 16) - 1) < 0.35 && Math.abs((((u % 20) + 20) % 20) - 10) < 3) set('detail', x, y, G.ROADLINE);
}

// gates / plazas
const gateFeatures = GEO.features.filter((f) => ['北门', '南门', '东门'].includes(f.properties?.name));
for (const f of gateFeatures) {
  const best = largestRing(f); if (!best) continue;
  const b = best.b;
  const x = Math.floor(toTileX((b.minX + b.maxX) / 2));
  const y = Math.floor(toTileY((b.minY + b.maxY) / 2));
  for (let yy = y - 4; yy <= y + 4; yy++) for (let xx = x - 5; xx <= x + 5; xx++) if (inMap(xx, yy)) set('ground', xx, yy, G.PLAZA);
}

const typeMap = {
  teaching: 'academic', experiment_building: 'lab', library: 'library', canteen: 'canteen',
  gymnasium: 'sports', student_bedroom: 'dorm', administration: 'academic',
  families_house: 'dorm', service_building: 'activity', hospital: 'lab',
  part_entrance: 'gate', others: 'activity', aa: 'activity',
};
const buildings = [];
const footprints = {};
const nameToBBox = new Map();
const occupied = new Set();

for (const f of GEO.features) {
  const name = f.properties?.name;
  if (!name || name === '未知') continue;
  const rings = allRings(f); if (!rings.length) continue;
  const best = largestRing(f); if (!best) continue;
  const b = best.b;
  const x0 = Math.floor(toTileX(b.minX)); const x1 = Math.ceil(toTileX(b.maxX));
  const y0 = Math.floor(toTileY(b.maxY)); const y1 = Math.ceil(toTileY(b.minY));
  const w = Math.max(1, x1 - x0); const h = Math.max(1, y1 - y0);
  if (!inMap(x0, y0) || w < 1 || h < 1) continue;
  const height = Number(f.properties?.height) || 0;
  const levels = Number(f.properties?.['building:levels']) || 0;
  const extrude = Math.max(22, Math.min(92, Math.round(Math.max(height * 3.2, levels * 9, 22))));
  const id = String(f.properties?.id ?? name);
  const key = `b_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const type = typeMap[f.properties?.building] ?? 'academic';
  const floors = Math.max(1, levels || Math.round(height / 4) || 3);
  const variant = hash(name) % 4;
  buildings.push({ id, name, type, key, x: x0, y: y0, w, h, floors, variant });
  // normalized largest ring, y is top-down
  const bw = b.maxX - b.minX; const bh = b.maxY - b.minY;
  const points = best.ring.map(([lng, lat]) => [
    Number(((lng - b.minX) / bw).toFixed(4)),
    Number(((b.maxY - lat) / bh).toFixed(4)),
  ]);
  footprints[id] = { name, height, levels, extrude, points };
  nameToBBox.set(name, { x0, y0, x1, y1, w, h, cx: Math.floor((x0 + x1) / 2), cy: Math.floor((y0 + y1) / 2) });

  // collision rasterization: tile centers inside any ring
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
    if (!inMap(xx, yy)) continue;
    const [lng, lat] = toLngLat(xx + 0.5, yy + 0.5);
    if (rings.some((ring) => pointInRing(ring, lng, lat))) { set('collision', xx, yy, G.SOLID); occupied.add(`${xx},${yy}`); }
  }
}

// ensure tiny/odd buildings have at least one solid tile
for (const b of buildings) {
  let any = false;
  for (let yy = b.y; yy < b.y + b.h && !any; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) if (layers.collision[at(xx, yy)] === G.SOLID) { any = true; break; }
  if (!any) set('collision', b.x, b.y, G.SOLID);
}

const walkable = (x, y) => inMap(x, y) && layers.collision[at(x, y)] === 0;
const nearFree = (x, y, radius = 8) => {
  for (let r = 0; r <= radius; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = x + dx; const yy = y + dy;
    if (walkable(xx, yy)) return { x: xx, y: yy };
  }
  return { x: Math.max(1, Math.min(W - 2, x)), y: Math.max(1, Math.min(H - 2, y)) };
};
const door = (name, offset = 1) => {
  const b = nameToBBox.get(name);
  if (!b) return null;
  return nearFree(b.cx, b.y1 + offset, 10);
};

// secondary paths / plazas at major doors
for (const name of nameToBBox.keys()) {
  const b = nameToBBox.get(name);
  const d = door(name, 2);
  if (!d) continue;
  for (let yy = d.y - 1; yy <= d.y + 2; yy++) for (let xx = d.x - 2; xx <= d.x + 2; xx++) if (walkable(xx, yy)) set('ground', xx, yy, G.PATH);
}

// nature: trees on free grass, flowerbeds on grass
const trees = [];
for (let i = 0; i < 900 && trees.length < 420; i++) {
  const x = 3 + Math.floor(rand() * (W - 6));
  const y = 3 + Math.floor(rand() * (H - 6));
  if (!walkable(x, y)) continue;
  if (layers.ground[at(x, y)] !== G.GRASS && layers.ground[at(x, y)] !== G.GRASS2 && layers.ground[at(x, y)] !== G.GRASS3) continue;
  trees.push({ x, y, variant: (x * 7 + y * 11) % 3 });
  set('collision', x, y, G.SOLID);
}
for (let i = 0; i < 700; i++) {
  const x = 2 + Math.floor(rand() * (W - 4));
  const y = 2 + Math.floor(rand() * (H - 4));
  if (walkable(x, y) && (layers.ground[at(x, y)] === G.GRASS || layers.ground[at(x, y)] === G.GRASS2 || layers.ground[at(x, y)] === G.GRASS3)) set('detail', x, y, G.FLOWER);
}

// benches and lamps along the grid
for (let y = 5; y < H - 4; y += 16) for (let x = 8; x < W - 8; x += 40) {
  if (walkable(x, y) && layers.ground[at(x, y)] === G.GRASS) { set('props', x, y, G.BENCH); set('collision', x, y, G.SOLID); }
}
for (let y = 8; y < H - 4; y += 20) for (let x = 6; x < W - 4; x += 24) {
  if (walkable(x, y)) { set('props', x, y, G.LAMP); set('collision', x, y, G.SOLID); }
}

// a blue track in the largest open area near the sports buildings
function findOpenRect(tw, th) {
  let best = null;
  for (let y = 4; y < H - th - 4; y += 2) for (let x = 4; x < W - tw - 4; x += 2) {
    let score = 0;
    for (let yy = y; yy < y + th; yy++) for (let xx = x; xx < x + tw; xx++) if (layers.collision[at(xx, yy)] === 0) score++;
    if (!best || score > best.score) best = { x, y, score };
  }
  return best;
}
const sportAnchor = nameToBBox.get('综合体育中心（新田径运动场）');
const trackSpot = sportAnchor ? { x: Math.max(3, sportAnchor.x0 - 25), y: Math.max(3, sportAnchor.y0) } : null;
if (trackSpot) {
  const x = trackSpot.x; const y = trackSpot.y;
  const tw = 21; const th = 14;
  let free = true;
  for (let yy = y; yy < y + th; yy++) for (let xx = x; xx < x + tw; xx++) if (!inMap(xx, yy) || layers.collision[at(xx, yy)]) free = false;
  if (free) {
    rect('ground', x, y, tw, th, G.TRACK_BLUE);
    rect('ground', x + 3, y + 3, tw - 6, th - 6, G.COURT);
    rect('detail', x, y, tw, 1, G.TRACK_BLUE_LINE);
    rect('detail', x, y + th - 1, tw, 1, G.TRACK_BLUE_LINE);
    rect('detail', x, y, 1, th, G.TRACK_BLUE_LINE);
    rect('detail', x + tw - 1, y, 1, th, G.TRACK_BLUE_LINE);
  }
}

const northGatePoint = door('北门', 2);
let spawn = northGatePoint ? { x: northGatePoint.x, y: northGatePoint.y + 2 } : { x: Math.floor(W / 2), y: Math.floor(H / 2) };
if (!walkable(spawn.x, spawn.y)) spawn = nearFree(spawn.x, spawn.y, 20);
const reachable = new Set();
const reachQueue = [[spawn.x, spawn.y]];
while (reachQueue.length) {
  const [x, y] = reachQueue.pop();
  const key = `${x},${y}`;
  if (reachable.has(key) || !walkable(x, y)) continue;
  reachable.add(key);
  reachQueue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}
function nearestReachable(x, y, radius = 30) {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      const xx = x + dx; const yy = y + dy;
      if (reachable.has(`${xx},${yy}`)) return { x: xx, y: yy };
    }
  }
  return { x: Math.max(1, Math.min(W - 2, x)), y: Math.max(1, Math.min(H - 2, y)) };
}

// triggers
const triggers = []; let tid = 1;
function trigger(id, kind, point, label, radius = 30, payload = '') {
  if (!point) return;
  point = nearestReachable(point.x, point.y, 30);
  triggers.push({
    id: tid++, name: id, type: '', x: point.x * 16 + 8, y: point.y * 16 + 8, width: 0, height: 0, point: true,
    properties: [
      { name: 'id', type: 'string', value: id },
      { name: 'kind', type: 'string', value: kind },
      { name: 'payload', type: 'string', value: payload },
      { name: 'label', type: 'string', value: label },
      { name: 'radius', type: 'int', value: radius },
    ],
  });
}

const northGate = northGatePoint;
const southGate = door('南门', -2);
const eastGate = door('东门', -2);
if (northGate) {
  trigger('signin', 'signin', northGate, '北门 · 每日签到');
  trigger('notice', 'notice', { x: northGate.x + 4, y: northGate.y }, '公告板');
  trigger('guard', 'dialogue', { x: northGate.x - 4, y: northGate.y }, '和保安大爷聊聊', 30, 'guard_first');
}
const classPoints = [
  ['睿智楼（基础部）', '睿智楼', 'class_ruizhi'],
  ['尚真楼（财经学院）', '尚真楼', 'class_finance'],
  ['融馨楼（计算机技术与应用学院）', '融馨楼', 'class_computer'],
  ['逸夫楼（农牧学院、林草学院）', '逸夫楼', 'class_agri'],
  ['圣汇楼A座', '圣汇楼', 'class_medicine'],
];
for (const [name, short, id] of classPoints) {
  const p = door(name, 2);
  if (p) trigger(id, 'class', p, `${short} · 上课`, 28, short);
}
const timetable = door('睿智楼（基础部）', 2);
if (timetable) trigger('timetable', 'timetable', { x: timetable.x + 3, y: timetable.y }, '课程表', 24);

const libraryDoor = door('图书馆', 2);
if (libraryDoor) {
  trigger('library_quiz', 'library_quiz', libraryDoor, '图书馆 · 知识问答');
  trigger('seat_hint', 'seat_hint', { x: libraryDoor.x + 4, y: libraryDoor.y }, '查看座位', 24);
  trigger('librarian', 'dialogue', { x: libraryDoor.x - 4, y: libraryDoor.y }, '和图书管理员聊聊', 26, 'librarian_first');
}
const canteenDoor = door('学生食堂', 2);
if (canteenDoor) {
  trigger('meal', 'meal', canteenDoor, '学生食堂 · 打饭', 30);
  trigger('auntie', 'dialogue', { x: canteenDoor.x + 4, y: canteenDoor.y }, '和食堂阿姨聊聊', 26, 'auntie_first');
}
const dorm = door('20号学生公寓', 2);
const dorm2 = door('10号学生公寓', 2);
if (dorm) trigger('sleep', 'sleep', dorm, '回学生公寓睡觉', 30);
if (dorm2) trigger('dorm_door', 'door', dorm2, '学生公寓（室内待开放）', 24);

const catPoints = [
  ['cat_orange', '大橘（学生公寓楼下）', 'orange', dorm],
  ['cat_black', '煤球（体育场看台）', 'black', door('体育场看台', 3)],
  ['cat_white', '雪球（睿智楼）', 'white', door('睿智楼（基础部）', 3)],
  ['cat_calico', '花花（学生食堂）', 'calico', canteenDoor],
  ['cat_scholar', '学霸（图书馆）', 'scholar', libraryDoor],
];
for (const [id, label, cat, point] of catPoints) if (point) trigger(id, 'cat', { x: point.x + 2, y: point.y }, label, 24, cat);

const stand = door('体育场看台', 3) || door('综合体育中心（新田径运动场）', 3);
if (stand) {
  trigger('trainer', 'dialogue', { x: stand.x - 4, y: stand.y }, '和神秘训练师聊聊', 30, 'trainer_first');
  trigger('battle', 'battle', { x: stand.x - 1, y: stand.y }, '宠物对战', 28);
  trigger('catclub', 'dialogue', { x: stand.x + 3, y: stand.y }, '和猫协同学聊聊', 28, 'catclub_first');
  trigger('hideseek', 'hideseek', { x: stand.x + 6, y: stand.y }, '躲猫猫', 28);
  trigger('grandstand', 'grandstand', { x: stand.x + 9, y: stand.y }, '体育场看台', 26);
}
if (dorm) trigger('vending', 'vending', { x: dorm.x + 2, y: dorm.y }, '自动售货机', 22);
const streetPoint = nearFree(90, 55, 16);
trigger('streetlight', 'streetlight', streetPoint, '路灯开关', 22);

// labels for major buildings; only nearby ones are shown at runtime
const labelSpecs = [
  ['北门', '北门'], ['南门', '南门'], ['东门', '东门'], ['图书馆', '图书馆'],
  ['综合体育中心（新田径运动场）', '综合体育中心'], ['学生食堂', '学生食堂'],
  ['20号学生公寓', '学生公寓'], ['10号学生公寓', '学生公寓'],
  ['睿智楼（基础部）', '睿智楼'], ['尚真楼（财经学院）', '尚真楼'],
  ['融馨楼（计算机技术与应用学院）', '融馨楼'], ['逸夫楼（农牧学院、林草学院）', '逸夫楼'],
  ['圣汇楼A座', '圣汇楼'], ['雨化楼（生态环境工程学院）', '雨化楼'],
  ['镂金楼（工科实验楼）', '镂金楼'], ['鼎新馆（马克思主义学院）', '鼎新馆'],
  ['静远楼（化工学院、重点实验室）', '静远楼'], ['求实楼（能源与电气工程学院、地质工程学院）', '求实楼'],
  ['智行楼（机械工程学院）', '智行楼'], ['明博楼（藏医楼）', '明博楼'],
  ['创新大厦', '创新大厦'], ['知远楼（信息化技术中心）', '知远楼'],
  ['行政楼A', '行政楼A'], ['行政楼B', '行政楼B'], ['行政楼C', '行政楼C'], ['行政楼D', '行政楼D'],
  ['盐湖资源楼', '盐湖资源楼'], ['公卫楼', '公卫楼'], ['专家公寓', '专家公寓'],
  ['青海大学国家大学科技园', '科技园'], ['星华楼（土木水利学院）', '星华楼'],
  ['尚原楼（农科实验楼）', '尚原楼'],
];
const labels = [];
for (const [name, text] of labelSpecs) {
  const b = nameToBBox.get(name);
  if (b) labels.push({ text, x: b.cx, y: Math.max(1, b.y0 - 1) });
}

// hidespots around the sports stand, as free tiles near it
const hidespots = [];
const standBox = nameToBBox.get('体育场看台') || nameToBBox.get('综合体育中心（新田径运动场）');
if (standBox) {
  const candidates = [
    [standBox.x0 - 5, standBox.cy], [standBox.x0 - 9, standBox.cy - 4],
    [standBox.cx, standBox.y0 - 3], [standBox.cx + 6, standBox.y0 - 4],
    [standBox.x1 + 4, standBox.cy], [standBox.x1 + 8, standBox.cy + 4],
    [standBox.cx - 6, standBox.y1 + 4], [standBox.cx + 5, standBox.y1 + 5],
  ];
  for (const [x, y] of candidates) { const p = nearestReachable(x, y, 16); hidespots.push({ id: `hide_${hidespots.length}`, name: `体育场藏点 ${hidespots.length + 1}`, tx: p.x, ty: p.y }); }
}

const hud = { width: W, height: H, spawn, labels, hidespots };
const map = {
  compressionlevel: -1, height: H, infinite: false,
  layers: [
    { data: layers.ground, height: H, id: 1, name: 'ground', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
    { data: layers.detail, height: H, id: 2, name: 'detail', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
    { data: layers.shadows, height: H, id: 3, name: 'shadows', opacity: 0.8, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
    { data: layers.buildings, height: H, id: 4, name: 'buildings', opacity: 1, type: 'tilelayer', visible: false, width: W, x: 0, y: 0 },
    { data: layers.props, height: H, id: 5, name: 'props', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
    { data: layers.collision, height: H, id: 6, name: 'collision', opacity: 0, type: 'tilelayer', visible: false, width: W, x: 0, y: 0 },
    { draworder: 'topdown', id: 7, name: 'triggers', objects: triggers, opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0 },
  ],
  nextlayerid: 8, nextobjectid: triggers.length + 1, orientation: 'orthogonal', renderorder: 'right-down',
  tiledversion: '1.11.2', tileheight: 16,
  tilesets: [{ columns: 16, firstgid: 1, image: '../tilesets/campus-tiles.png', imageheight: 48, imagewidth: 256, margin: 0, name: 'campus', spacing: 0, tilecount: 48, tileheight: 16, tilewidth: 16 }],
  tilewidth: 16, version: '1.10', width: W,
};

mkdirSync(join(ROOT, 'client', 'public', 'assets', 'maps'), { recursive: true });
mkdirSync(join(ROOT, 'client', 'src', 'data'), { recursive: true });
writeFileSync(join(ROOT, 'client', 'public', 'assets', 'maps', 'campus.tmj'), JSON.stringify(map));
writeFileSync(join(ROOT, 'maps', 'campus.tmj'), JSON.stringify(map));
writeFileSync(join(ROOT, 'client', 'src', 'data', 'buildings.json'), JSON.stringify(buildings, null, 1));
writeFileSync(join(ROOT, 'client', 'src', 'data', 'footprints.json'), JSON.stringify(footprints, null, 1));
writeFileSync(join(ROOT, 'client', 'src', 'data', 'trees.json'), JSON.stringify(trees, null, 1));
writeFileSync(join(ROOT, 'client', 'src', 'data', 'hidespots.json'), JSON.stringify(hidespots, null, 1));
writeFileSync(join(ROOT, 'client', 'src', 'data', 'map-meta.json'), JSON.stringify(hud, null, 1));
console.log('full map', W, H, 'buildings', buildings.length, 'trees', trees.length, 'triggers', triggers.length, 'labels', labels.length, 'spawn', spawn, 'hidespots', hidespots.length);
