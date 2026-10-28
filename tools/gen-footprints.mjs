import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const geo = JSON.parse(readFileSync(join(ROOT, 'maps', 'qhu-buildings.geojson'), 'utf8'));

const NAME_MAP = {
  mingbo: '明博楼（藏医楼）',
  dorm_a: '20号学生公寓',
  dorm_b: '24号学生公寓',
  dorm_c: '10号学生公寓',
  dorm_d: '11号学生公寓',
  canteen: '学生食堂',
  sports: '综合体育中心（新田径运动场）',
  library: '图书馆',
  ruizhi: '睿智楼（基础部）',
  yuhua: '雨化楼（生态环境工程学院）',
  loujin: '镂金楼（工科实验楼）',
  shangzhen: '尚真楼（财经学院）',
  rongxin: '融馨楼（计算机技术与应用学院）',
  yifu: '逸夫楼（农牧学院、林草学院）',
  dingxin: '鼎新馆（马克思主义学院）',
  shenghui: '圣汇楼A座',
  mechanical: '智行楼（机械工程学院）',
  jingyuan: '静远楼（化工学院、重点实验室）',
  qiushi: '求实楼（能源与电气工程学院、地质工程学院）',
};

function allRings(feature) {
  const rings = [];
  for (const polygon of feature.geometry.coordinates) {
    if (Array.isArray(polygon[0])) rings.push(polygon[0]);
    else rings.push(polygon);
  }
  return rings;
}

const result = {};
for (const [id, name] of Object.entries(NAME_MAP)) {
  const feature = geo.features.find((f) => f.properties?.name === name);
  if (!feature) {
    console.warn('missing footprint', id, name);
    continue;
  }
  const rings = allRings(feature).filter((r) => r.length >= 3);
  // Use the largest ring (main building body); annexes stay in the footprint silhouette only if attached.
  let best = null;
  let bestArea = -1;
  for (const ring of rings) {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const [x, y] of ring) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const area = (maxX - minX) * (maxY - minY);
    if (area > bestArea) { bestArea = area; best = { ring, minX, minY, maxX, maxY }; }
  }
  if (!best || bestArea <= 0) continue;
  const w = best.maxX - best.minX;
  const h = best.maxY - best.minY;
  const points = best.ring.map(([lng, lat]) => [
    Number(((lng - best.minX) / w).toFixed(4)),
    Number(((best.maxY - lat) / h).toFixed(4)),
  ]);
  const height = Number(feature.properties?.height) || 0;
  const levels = Number(feature.properties?.['building:levels']) || 0;
  const extrude = Math.max(26, Math.min(100, Math.round(Math.max(height * 3.4, levels * 10, 26))));
  result[id] = { name, height, levels, extrude, points };
}

writeFileSync(join(ROOT, 'client', 'src', 'data', 'footprints.json'), JSON.stringify(result, null, 1));
console.log('footprints', Object.keys(result).length);
