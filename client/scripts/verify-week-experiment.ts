import { readFileSync, statSync } from 'node:fs';
import { MAX_EXPERIMENT_JSON_LENGTH, verifyWeekExperiment } from '../src/sim/experiment';

const path = process.argv[2];
if (!path) {
  console.error('用法：npx vite-node scripts/verify-week-experiment.ts <周策略实验.json>');
  process.exitCode = 2;
} else {
  try {
    // A UTF-8 character uses at most four bytes; reject huge files before reading.
    if (statSync(path).size > MAX_EXPERIMENT_JSON_LENGTH * 4) throw new Error('实验文件过大。');
    const result = verifyWeekExperiment(readFileSync(path, 'utf8'));
    console.log(JSON.stringify({ valid: result.valid, reason: result.reason }, null, 2));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : '无法读取实验文件。');
    process.exitCode = 1;
  }
}
