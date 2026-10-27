import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'client', 'public', 'assets', 'maps');
const SRC = join(ROOT, 'maps');
const W = 160;
const H = 120;

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

// --- outer fence / north gate opening ---
for (let x = 0; x < W; x++) {
  if (x >= 68 && x <= 74) continue;
  set('props', x, 1, G.FENCE);
  set('collision', x, 1, G.SOLID);
}

// --- perimeter roads + main internal roads ---
groundRect(6, 6, 145, 5, G.ROAD);
groundRect(6, 110, 145, 5, G.ROAD);
groundRect(4, 6, 5, 109, G.ROAD);
groundRect(150, 6, 5, 109, G.ROAD);
groundRect(70, 10, 5, 56, G.ROAD);
groundRect(8, 62, 142, 5, G.ROAD);
groundRect(90, 66, 5, 44, G.ROAD);
groundRect(100, 10, 5, 52, G.PATH);

// --- gate plazas ---
groundRect(64, 2, 15, 11, G.PLAZA);
groundRect(0, 72, 10, 9, G.PLAZA);
groundRect(150, 62, 9, 10, G.PLAZA);
groundRect(88, 110, 13, 9, G.PLAZA);

// --- secondary paths / forecourts ---
groundRect(70, 38, 77, 4, G.PATH);
groundRect(18, 10, 4, 52, G.PATH);
groundRect(104, 34, 4, 28, G.PATH);
groundRect(26, 66, 5, 13, G.PATH);
groundRect(33, 66, 4, 2, G.PATH);
groundRect(8, 96, 4, 3, G.PATH);
groundRect(12, 95, 30, 3, G.PATH);
groundRect(44, 78, 12, 2, G.PATH);
groundRect(54, 89, 4, 12, G.PATH);
groundRect(76, 94, 4, 15, G.PATH);
groundRect(96, 94, 4, 16, G.PATH);
groundRect(108, 58, 4, 10, G.PATH);
groundRect(112, 76, 4, 4, G.PATH);
groundRect(128, 34, 4, 28, G.PATH);
groundRect(6, 62, 4, 14, G.PATH);

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
track(26, 44, 21, 15);
track(76, 44, 21, 15);

// --- park and pond ---
groundRect(8, 20, 9, 9, G.WATERDARK);
groundRect(9, 21, 7, 7, G.WATER);
groundRect(7, 19, 11, 1, G.PATH);
groundRect(7, 29, 11, 1, G.PATH);
groundRect(7, 20, 1, 9, G.PATH);
groundRect(17, 20, 1, 9, G.PATH);

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
building(63, 2, 6, 4, { wall: G.WALL_BRICK, roofH: 2, doorW: 1 });
building(75, 2, 6, 4, { wall: G.WALL_BRICK, roofH: 2, doorW: 1 });
// north-east: 藏医学院明博楼 + student apartments + canteen
building(96, 10, 13, 8, { wall: G.WALL, roofH: 4 });
building(112, 14, 11, 8, { wall: G.WALL, roofH: 4 });
building(126, 14, 11, 8, { wall: G.WALL_BRICK, roofH: 4 });
building(112, 26, 11, 8, { wall: G.WALL, roofH: 4 });
building(126, 26, 11, 8, { wall: G.WALL_BRICK, roofH: 4 });
building(138, 24, 12, 10, { wall: G.WALL_BRICK, roofH: 4 });
// activity centre + sports centre + library
building(22, 24, 14, 9, { wall: G.WALL, roofH: 4 });
building(8, 54, 12, 8, { wall: G.WALL_BRICK, roofH: 3 });
building(26, 68, 18, 10, { wall: G.WALL, roofH: 5 });
// east academic cluster
building(108, 48, 18, 10, { wall: G.WALL, roofH: 5 });
building(112, 68, 16, 8, { wall: G.WALL, roofH: 4 });
building(112, 80, 16, 9, { wall: G.WALL_BRICK, roofH: 4 });
// south academic cluster
building(56, 78, 18, 10, { wall: G.WALL, roofH: 4 });
building(76, 84, 13, 10, { wall: G.WALL_BRICK, roofH: 4 });
building(96, 84, 14, 10, { wall: G.WALL, roofH: 4 });
building(76, 70, 12, 7, { wall: G.WALL, roofH: 3 });
building(54, 100, 15, 9, { wall: G.WALL_BRICK, roofH: 4 });
building(26, 100, 14, 9, { wall: G.WALL, roofH: 4 });
building(12, 86, 14, 9, { wall: G.WALL_BRICK, roofH: 4 });
building(8, 98, 14, 9, { wall: G.WALL, roofH: 4 });

// --- trees ---
const trees = [
  [14, 12], [22, 12], [44, 12], [52, 12], [82, 12], [90, 12], [110, 8],
  [40, 20], [46, 20], [74, 20], [80, 20], [88, 20], [140, 12], [146, 16],
  [14, 36], [20, 40], [48, 38], [54, 42], [60, 46], [68, 50], [98, 40],
  [104, 62], [108, 64], [132, 50], [138, 52], [144, 58], [148, 62],
  [8, 34], [8, 44], [8, 66], [8, 78], [8, 82], [8, 108], [20, 110],
  [24, 62], [46, 62], [50, 66], [52, 74], [46, 76], [44, 98], [50, 110],
  [132, 66], [138, 72], [144, 80], [148, 88], [140, 96], [132, 100],
  [128, 92], [120, 94], [106, 100], [92, 100], [86, 106], [74, 108],
  [66, 112], [54, 114], [38, 114], [28, 114], [18, 114], [6, 118],
  [148, 118], [154, 108], [154, 96], [154, 84], [154, 30], [154, 18],
  [148, 6], [136, 6], [118, 6], [86, 6], [58, 6], [40, 6], [28, 6],
];
for (const [x, y] of trees) {
  set('props', x, y - 1, G.TREE);
  set('props', x, y, G.TRUNK);
  set('collision', x, y, G.SOLID);
  set('shadows', x, y, G.SHADOW);
}

// hedges around key buildings
for (const [x, y, w] of [[25, 67, 20], [107, 47, 20], [111, 67, 18], [55, 77, 20], [75, 83, 15], [95, 83, 16], [53, 99, 17], [25, 99, 16]]) {
  for (let i = 0; i < w; i++) { set('props', x + i, y, G.HEDGE); set('collision', x + i, y, G.SOLID); }
}

// benches, lamps, flowerbeds
const benches = [
  [24, 61], [32, 61], [40, 61], [48, 61], [52, 58], [60, 58],
  [28, 80], [38, 80], [50, 82], [72, 82], [90, 96], [108, 96],
  [104, 40], [130, 40], [116, 42], [142, 42], [16, 32], [30, 34],
];
for (const [x, y] of benches) { set('props', x, y, G.BENCH); set('collision', x, y, G.SOLID); }
const lamps = [
  [68, 12], [76, 12], [68, 30], [76, 30], [68, 48], [76, 48], [68, 60], [76, 60],
  [68, 76], [76, 76], [68, 94], [76, 94], [68, 108], [76, 108],
  [10, 62], [24, 62], [42, 62], [58, 62], [82, 62], [102, 62], [118, 62], [136, 62],
  [24, 43], [48, 43], [74, 43], [98, 43], [124, 43], [146, 43],
  [24, 59], [48, 59], [74, 59], [98, 59], [124, 59], [146, 59],
  [100, 38], [146, 38], [6, 74], [152, 66],
];
for (const [x, y] of lamps) { set('props', x, y, G.LAMP); set('collision', x, y, G.SOLID); }
const flowers = [
  [44, 10], [56, 10], [88, 10], [104, 10], [140, 40], [146, 46],
  [22, 66], [48, 66], [44, 82], [64, 74], [80, 78], [96, 80],
  [104, 74], [128, 56], [136, 58], [12, 84], [38, 94], [70, 96],
];
for (const [x, y] of flowers) { set('props', x, y, G.FLOWERBED); set('collision', x, y, G.SOLID); }

// signs
for (const [x, y] of [[62, 5], [78, 5], [23, 33], [35, 78], [143, 34], [111, 34], [125, 34], [117, 58], [65, 88], [82, 94], [103, 94], [61, 109], [6, 72], [152, 62], [90, 110]]) {
  set('props', x, y, G.SIGN);
}

// scatter flowers on free grass
let seed = 29;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
for (let i = 0; i < 420; i++) {
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

trigger('signin', 'signin', 71, 8, '北门 · 每日签到');
trigger('notice', 'notice', 77, 8, '公告板');
trigger('guard', 'dialogue', 66, 10, '和保安大爷聊聊', 30, 'guard_first');
trigger('class_ruizhi', 'class', 117, 58, '睿智楼（数理/外语）· 上课', 30, '睿智楼');
trigger('timetable', 'timetable', 122, 58, '课程表', 24);
trigger('class_finance', 'class', 65, 88, '尚真楼（财经/人文）· 上课', 28, '尚真楼');
trigger('class_computer', 'class', 82, 94, '融馨楼（计算机学院）· 上课', 28, '融馨楼');
trigger('class_agri', 'class', 103, 94, '逸夫楼（农牧学院）· 上课', 28, '逸夫楼');
trigger('class_medicine', 'class', 61, 109, '圣汇楼（基础医学）· 上课', 28, '圣汇楼');
trigger('library_quiz', 'library_quiz', 35, 78, '图书馆 · 知识问答');
trigger('seat_hint', 'seat_hint', 40, 78, '查看座位', 24);
trigger('librarian', 'dialogue', 44, 79, '和图书管理员聊聊', 26, 'librarian_first');
trigger('meal', 'meal', 144, 34, '学生食堂 · 打饭', 30);
trigger('auntie', 'dialogue', 148, 35, '和食堂阿姨聊聊', 26, 'auntie_first');
trigger('sleep', 'sleep', 117, 34, '回学生公寓睡觉', 30);
trigger('dorm_door', 'door', 131, 34, '学生公寓（室内待开放）', 24);
trigger('cat_orange', 'cat', 113, 35, '大橘（学生公寓楼下）', 24, 'orange');
trigger('cat_black', 'cat', 86, 60, '煤球（东田径场）', 24, 'black');
trigger('cat_white', 'cat', 106, 58, '雪球（睿智楼台阶）', 24, 'white');
trigger('cat_calico', 'cat', 146, 34, '花花（学生食堂后门）', 24, 'calico');
trigger('cat_scholar', 'cat', 44, 78, '学霸（图书馆）', 24, 'scholar');
trigger('trainer', 'dialogue', 49, 60, '和神秘训练师聊聊', 30, 'trainer_first');
trigger('battle', 'battle', 50, 58, '宠物对战', 28);
trigger('catclub', 'dialogue', 28, 60, '和猫协同学聊聊', 28, 'catclub_first');
trigger('hideseek', 'hideseek', 32, 60, '躲猫猫', 28);
trigger('grandstand', 'grandstand', 36, 60, '西田径场看台', 26);
trigger('vending', 'vending', 100, 40, '自动售货机', 22);
trigger('streetlight', 'streetlight', 72, 64, '路灯开关', 22);

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
console.log('full QHU map written', W, H, 'triggers', triggers.length);
