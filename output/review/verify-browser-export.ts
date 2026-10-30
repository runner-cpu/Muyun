import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { replayRun } from '../../client/src/sim/replay';
import { captureMetrics } from '../../client/src/sim/history';

// From client/: npx vite-node ../output/review/verify-browser-export.ts [input.json] [copy.json]
// Verification is read-only unless an explicit copy destination is provided.
const input = process.argv[2] ?? fileURLToPath(new URL('./feasible-phase2-winter-challenge-v1-20261015.json', import.meta.url));
const copyTo = process.argv[3];
try {
  const text = readFileSync(input, 'utf8');
  const source = JSON.parse(text);
  const restored = replayRun(text);
  if (copyTo) writeFileSync(copyTo, text, { flag: 'wx' });
  console.log(JSON.stringify({
    schema: source.schema,
    source: source.source.kind,
    weeks: restored.tracking?.weeks.map(record => record.week),
    ended: restored.ended,
    match: JSON.stringify(captureMetrics(restored)) === JSON.stringify(source.result.metrics),
    metrics: captureMetrics(restored),
  }, null, 2));
} catch (error) {
  console.error(`经营记录复验失败（${input}）：${error instanceof Error ? error.message : '无法读取或复验该文件。'}`);
  console.error('用法：npx vite-node ../output/review/verify-browser-export.ts [经营记录.json] [新副本.json]；不指定输入时复验项目内当前规则样例，副本路径必须尚不存在。');
  process.exitCode = 1;
}
