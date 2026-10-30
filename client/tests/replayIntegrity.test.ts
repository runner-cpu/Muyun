import { describe, expect, it } from 'vitest';
import { createWinterChallenge } from '../src/sim/scenarios';
import { endWeek } from '../src/sim/run';
import { exportRun, replayRun } from '../src/sim/replay';
import type { RunExport } from '../src/sim/replay';
import { captureMetrics } from '../src/sim/history';

function completedExport(): RunExport {
  let state = createWinterChallenge();
  while (!state.ended) state = endWeek(state);
  return JSON.parse(exportRun(state)) as RunExport;
}

describe('recorded-run evidence consistency', () => {
  it('keeps existing v1 exports replayable, including a JSON object with reordered keys', () => {
    const payload = completedExport();
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
    expect(captureMetrics(replayRun(JSON.stringify(reorder(payload))))).toEqual(payload.result.metrics);
  });

  it.each([
    ['formula version', (p: RunExport) => { p.assessmentFormulaVersion = 'unsupported-formula'; }],
    ['assessment baseline', (p: RunExport) => { p.baseline.netAssets = 1; }],
    ['finished status', (p: RunExport) => { p.result.ended = false; }],
    ['ending', (p: RunExport) => { p.result.ending = p.result.ending === 'cooperative' ? 'collapse' : 'cooperative'; }],
    ['assessment score', (p: RunExport) => { p.result.assessment.overall = 999; }],
    ['scenario declaration', (p: RunExport) => { p.scenario.id = 'year'; }],
    ['seed declaration', (p: RunExport) => { p.seed += 1; }],
    ['recorded interval', (p: RunExport) => { p.source.toWeek -= 1; }],
  ] as const)('rejects an altered %s while physical metrics remain unchanged', (_label, mutate) => {
    const payload = completedExport();
    mutate(payload);
    expect(() => replayRun(payload)).toThrow();
  });
});
