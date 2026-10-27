import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'client', 'public', 'assets', 'maps');
const SRC = join(ROOT, 'maps');
const W = 120;
const H = 90;

const G = {
  GRASS: 1, FLOWER: 2, PATH: 3, PLAZA: 4, ROAD: 5, ROADLINE: 6,
  WATER: 7, WATERDARK: 8, WALL: 9, WALL_BRICK: 10, WINDOW: 11, DOOR: 12,
  ROOF: 13, ROOF_RIDGE: 14, STEPS: 15, TREE: 16, TRUNK: 17, HEDGE: 18,
  TRACK: 19, TRACKLINE: 20, COURT: 21, COURTLINE: 22, BENCH: 23, LAMP: 24,
  FLOWERBED: 25, FOUNTAIN: 26, FENCE: 27, SIGN: 28, ROOF_EDGE: 29, SHADOW: 30, SOLID: 31,
};

const empty = () => new Array(W * H).fill(0);
const layers = { ground: empty(), detail: empty(), shadows: empty(), buildings: empty(), props: empty(), collision: empty() };
const at = (x, y) => y * W + x;
const set = (layer, x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) layers[layer][at(x, y)] = v; };
const rect = (layer, x, y, w, h, v) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(layer, xx, yy, v); };
const groundRect = (x, y, w, h, v) => rect('ground', x, y, w, h, v);
const solidRect = (x, y, w, h) => rect('collision', x, y, w, h, G.SOLID);

rect('ground', 0, 0, W, H, G.GRASS);

// --- perimeter fence and north gate ---
for (let x = 0; x < W; x++) {
  if (x >= 50 && x <= 58) continue;
  set('props', x, 1, G.FENCE);
  set('collision', x, 1, G.SOLID);
}

// --- roads: perimeter loop, central axes, gate links ---
groundRect(6, 5, 109, 5, G.ROAD);
groundRect(6, 82, 109, 5, G.ROAD);
groundRect(4, 5, 5, 82, G.ROAD);
groundRect(112, 5, 5, 82, G.ROAD);
groundRect(54, 9, 5, 74, G.ROAD);
groundRect(8, 47, 105, 5, G.ROAD);
groundRect(68, 79, 5, 7, G.ROAD);
groundRect(6, 51, 5, 7, G.ROAD);

// --- plazas / forecourts ---
groundRect(46, 2, 19, 10, G.PLAZA);      // north gate plaza
groundRect(0, 51, 10, 10, G.PLAZA);      // west gate
groundRect(110, 45, 9, 10, G.PLAZA);     // east gate
groundRect(64, 84, 13, 5, G.PLAZA);      // south gate
groundRect(72, 10, 34, 3, G.PATH);       // dorm north path
groundRect(72, 30, 39, 3, G.PATH);       // dorm / canteen south path
groundRect(103, 30, 4, 18, G.PATH);      // canteen to central
groundRect(84, 45, 22, 2, G.PATH);       // main building forecourt
groundRect(36, 45, 4, 4, G.PATH);        // west track to central
groundRect(35, 28, 5, 19, G.PATH);       // around west track
groundRect(14, 45, 25, 2, G.PATH);       // west track south
groundRect(24, 64, 4, 9, G.PATH);        // library south
groundRect(36, 56, 4, 24, G.PATH);       // library east spine
groundRect(36, 56, 64, 2, G.PATH);       // academic north path
groundRect(13, 70, 52, 2, G.PATH);       // academic middle path
groundRect(24, 16, 3, 10, G.PATH);       // student activity link
groundRect(6, 14, 8, 2, G.PATH);         // park link

// --- tracks ---
function track(x, y, w, h) {
  groundRect(x, y, w, h, G.TRACK);
  groundRect(x + 3, y + 3, w - 6, h - 6, G.COURT);
  rect('detail', x, y, w, 1, G.TRACKLINE);
  rect('detail', x, y + h - 1, w, 1, G.TRACKLINE);
  rect('detail', x, y, 1, h, G.TRACKLINE);
  rect('detail', x + w - 1, y, 1, h, G.TRACKLINE);
  rect('detail', x + 3, y + 3, w - 6, 1, G.COURTLINE);
  rect('detail', x + 3, y + h - 4, w - 6, 1, G.COURTLINE);
}
track(14, 30, 21, 15);   // 西田径场
track(62, 30, 21, 15);   // 东田径场

// --- pond / park (near student centre) ---
groundRect(6, 16, 8, 8, G.WATERDARK);
groundRect(7, 17, 6, 6, G.WATER);
groundRect(5, 15, 10, 1, G.PATH);
groundRect(5, 24, 10, 1, G.PATH);
groundRect(5, 16, 1, 8, G.PATH);
groundRect(14, 16, 1, 8, G.PATH);

// --- buildings ---
function building(x, y, w, h, opts = {}) {
  const wall = opts.wall ?? G.WALL;
  const roofH = opts.roofH ?? Math.max(4, Math.floor(h * 0.48));
  const doorW = opts.doorW ?? 2;
  const doorX = x + Math.floor((w - doorW) / 2);
  for (let xx = x + 1; xx < x + w + 1; xx++) {
    set('shadows', xx, y + h, G.SHADOW);
    set('shadows', xx, y + h + 1, G.SHADOW);
  }
  for (let yy = y; yy < y + roofH; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      set('buildings', xx, yy, yy === y ? G.ROOF_RIDGE : yy === y + roofH - 1 ? G.ROOF_EDGE : G.ROOF);
    }
  }
  for (let yy = y + roofH; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const isEdge = xx === x || xx === x + w - 1 || yy === y + h - 1;
      set('buildings', xx, yy, isEdge ? G.WALL_BRICK : wall);
    }
  }
  for (let yy = y + roofH + 1; yy < y + h - 1; yy += 3) {
    for (let xx = x + 2; xx < x + w - 2; xx += 4) {
      if (xx >= doorX - 1 && xx <= doorX + doorW) continue;
      set('buildings', xx, yy, G.WINDOW);
      set('buildings', xx + 1, yy, G.WINDOW);
    }
  }
  for (let xx = doorX; xx < doorX + doorW; xx++) set('buildings', xx, y + h - 1, G.DOOR);
  for (let xx = doorX - 1; xx < doorX + doorW + 1; xx++) set('detail', xx, y + h, G.STEPS);
  set('props', doorX - 2, y + h - 1, G.SIGN);
  solidRect(x, y, w, h);
  return { doorX: doorX + doorW / 2, doorY: y + h - 1, x, y, w, h };
}

// gates
building(43, 2, 6, 4, { wall: G.WALL_BRICK, roofH: 2, doorW: 1 });
building(60, 2, 6, 4, { wall: G.WALL_BRICK, roofH: 2, doorW: 1 });
// dorms (north-east cluster)
const dormA = building(74, 12, 11, 8, { wall: G.WALL, roofH: 4 });
const dormB = building(88, 12, 11, 8, { wall: G.WALL, roofH: 4 });
const dormC = building(74, 22, 11, 8, { wall: G.WALL, roofH: 4 });
const dormD = building(88, 22, 11, 8, { wall: G.WALL_BRICK, roofH: 4 });
// canteen and student activity centre
const canteen = building(100, 20, 12, 10, { wall: G.WALL_BRICK, roofH: 4 });
const activity = building(16, 16, 13, 9, { wall: G.WALL, roofH: 4 });
// library
const library = building(18, 52, 17, 11, { wall: G.WALL, roofH: 5 });
// sports centre
const sports = building(5, 38, 8, 7, { wall: G.WALL_BRICK, roofH: 3 });
// main teaching / 睿智楼
const main = building(84, 34, 19, 11, { wall: G.WALL, roofH: 5 });
// academic south
building(37, 58, 16, 10, { wall: G.WALL, roofH: 4 });
building(60, 62, 15, 10, { wall: G.WALL_BRICK, roofH: 4 });
building(84, 58, 17, 10, { wall: G.WALL, roofH: 4 });
building(36, 72, 15, 9, { wall: G.WALL_BRICK, roofH: 4 });
building(58, 73, 15, 9, { wall: G.WALL, roofH: 4 });
building(76, 72, 15, 9, { wall: G.WALL_BRICK, roofH: 4 });
building(14, 68, 15, 9, { wall: G.WALL, roofH: 4 });
building(8, 58, 15, 9, { wall: G.WALL_BRICK, roofH: 4 });

// --- trees ---
const trees = [
  [12, 12], [20, 12], [34, 12], [40, 12], [70, 12], [72, 38], [70, 48],
  [10, 30], [10, 34], [10, 44], [40, 30], [40, 34], [40, 40], [40, 44],
  [12, 50], [16, 50], [38, 50], [42, 52], [42, 54], [42, 66], [42, 70],
  [8, 72], [8, 78], [30, 60], [32, 66], [34, 74], [54, 60], [56, 70],
  [72, 62], [74, 70], [102, 62], [104, 70], [106, 74], [108, 80],
  [24, 78], [52, 78], [64, 80], [86, 82], [100, 82], [112, 30], [112, 70],
  [6, 10], [10, 10], [26, 10], [36, 10], [44, 10], [66, 10], [102, 10],
  [108, 12], [108, 22], [108, 34], [8, 84], [20, 84], [46, 84], [96, 84],
];
for (const [x, y] of trees) {
  set('props', x, y - 1, G.TREE);
  set('props', x, y, G.TRUNK);
  set('collision', x, y, G.SOLID);
  set('shadows', x, y, G.SHADOW);
}

// --- hedges ---
for (const [x, y, w] of [[17, 51, 19], [83, 33, 21], [73, 11, 27], [73, 21, 27], [36, 57, 18], [83, 57, 19], [15, 67, 16]]) {
  for (let i = 0; i < w; i++) { set('props', x + i, y, G.HEDGE); set('collision', x + i, y, G.SOLID); }
}

// --- benches, lamps, flowerbeds ---
const benches = [
  [12, 46], [20, 46], [28, 46], [36, 46], [52, 44], [60, 44],
  [26, 65], [34, 65], [46, 67], [70, 67], [92, 67], [104, 32],
  [76, 32], [86, 32], [100, 46], [108, 46], [12, 14], [22, 26],
];
for (const [x, y] of benches) { set('props', x, y, G.BENCH); set('collision', x, y, G.SOLID); }
const lamps = [
  [52, 12], [60, 12], [52, 24], [60, 24], [52, 36], [60, 36],
  [52, 48], [60, 48], [52, 60], [60, 60], [52, 72], [60, 72],
  [10, 47], [24, 47], [38, 47], [76, 47], [90, 47], [104, 47],
  [14, 29], [35, 29], [62, 29], [83, 29], [14, 45], [35, 45],
  [62, 45], [83, 45], [72, 31], [100, 31], [6, 52], [112, 52],
];
for (const [x, y] of lamps) { set('props', x, y, G.LAMP); set('collision', x, y, G.SOLID); }
const flowers = [
  [45, 11], [65, 11], [72, 9], [106, 9], [38, 46], [42, 46],
  [16, 50], [36, 50], [36, 64], [40, 64], [70, 56], [82, 56],
  [104, 56], [12, 66], [30, 66], [52, 70], [72, 70], [92, 70],
];
for (const [x, y] of flowers) { set('props', x, y, G.FLOWERBED); set('collision', x, y, G.SOLID); }

// signs
for (const [x, y] of [[44, 5], [66, 5], [17, 25], [35, 63], [97, 30], [73, 30], [83, 45], [103, 45], [64, 84], [8, 52], [112, 46]]) {
  set('props', x, y, G.SIGN);
}

// flowers on free grass
let seed = 17;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
for (let i = 0; i < 300; i++) {
  const x = Math.floor(rnd() * W);
  const y = Math.floor(rnd() * H);
  if (layers.ground[at(x, y)] === G.GRASS && layers.buildings[at(x, y)] === 0) set('detail', x, y, G.FLOWER);
}

// --- triggers ---
const triggers = [];
let tid = 1;
function trigger(id, kind, tx, ty, label, radius = 30, payload = '') {
  triggers.push({
    id: tid++, name: id, type: '', x: tx * 16 + 8, y: ty * 16 + 8, width: 0, height: 0, point: true,
    properties: [
      { name: 'id', type: 'string', value: id },
      { name: 'kind', type: 'string', value: kind },
      { name: 'payload', type: 'string', value: payload },
      { name: 'label', type: 'string', value: label },
      { name: 'radius', type: 'int', value: radius },
    ],
  });
}

trigger('signin', 'signin', 54, 7, '北门 · 每日签到');
trigger('notice', 'notice', 60, 7, '公告板');
trigger('guard', 'dialogue', 48, 9, '和保安大爷聊聊', 30, 'guard_first');
trigger('main_class', 'class', 93, 45, '睿智楼 · 主教学楼', 30);
trigger('timetable', 'timetable', 98, 45, '课程表', 24);
trigger('library_quiz', 'library_quiz', 26, 64, '图书馆 · 知识问答');
trigger('seat_hint', 'seat_hint', 31, 64, '查看座位', 24);
trigger('librarian', 'dialogue', 31, 63, '和图书管理员聊聊', 26, 'librarian_first');
trigger('meal', 'meal', 105, 30, '学生食堂 · 打饭', 30);
trigger('auntie', 'dialogue', 108, 31, '和食堂阿姨聊聊', 26, 'auntie_first');
trigger('sleep', 'sleep', 79, 30, '回宿舍睡觉', 30);
trigger('dorm_door', 'door', 95, 30, '学生公寓（室内待开放）', 24);
trigger('cat_orange', 'cat', 86, 31, '大橘（学生公寓楼下）', 24, 'orange');
trigger('cat_black', 'cat', 60, 46, '煤球（东田径场）', 24, 'black');
trigger('cat_white', 'cat', 84, 46, '雪球（主楼台阶）', 24, 'white');
trigger('cat_calico', 'cat', 108, 32, '花花（学生食堂后门）', 24, 'calico');
trigger('cat_scholar', 'cat', 36, 62, '学霸（图书馆）', 24, 'scholar');
trigger('trainer', 'dialogue', 36, 43, '和神秘训练师聊聊', 30, 'trainer_first');
trigger('battle', 'battle', 38, 42, '宠物对战', 28);
trigger('catclub', 'dialogue', 18, 45, '和猫协同学聊聊', 28, 'catclub_first');
trigger('hideseek', 'hideseek', 22, 45, '躲猫猫', 28);
trigger('grandstand', 'grandstand', 27, 47, '西田径场看台', 26);
trigger('vending', 'vending', 70, 32, '自动售货机', 22);
trigger('streetlight', 'streetlight', 56, 52, '路灯开关', 22);

const map = {
  compressionlevel: -1,
  height: H,
  infinite: false,
  layers: [
    { data: layers.ground, height: H, id: 1, name: 'ground', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
    { data: layers.detail, height: H, id: 2, name: 'detail', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
    { data: layers.shadows, height: H, id: 3, name: 'shadows', opacity: 0.8, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
    { data: layers.buildings, height: H, id: 4, name: 'buildings', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
    { data: layers.props, height: H, id: 5, name: 'props', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
    { data: layers.collision, height: H, id: 6, name: 'collision', opacity: 0, type: 'tilelayer', visible: false, width: W, x: 0, y: 0 },
    { draworder: 'topdown', id: 7, name: 'triggers', objects: triggers, opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0 },
  ],
  nextlayerid: 8,
  nextobjectid: triggers.length + 1,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.11.2',
  tileheight: 16,
  tilesets: [{
    columns: 16, firstgid: 1, image: '../tilesets/campus-tiles.png', imageheight: 32, imagewidth: 256,
    margin: 0, name: 'campus', spacing: 0, tilecount: 32, tileheight: 16, tilewidth: 16,
  }],
  tilewidth: 16,
  version: '1.10',
  width: W,
};

const json = JSON.stringify(map);
mkdirSync(OUT, { recursive: true });
mkdirSync(SRC, { recursive: true });
writeFileSync(join(OUT, 'campus.tmj'), json);
writeFileSync(join(SRC, 'campus.tmj'), json);
console.log('QHU-inspired map written', W, H, 'triggers', triggers.length, { main, library, canteen, dormA, dormB, dormC, dormD, sports, activity });
