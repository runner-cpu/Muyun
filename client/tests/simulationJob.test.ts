import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSimulationJob } from '../src/systems/SimulationJob';
import { createWinterChallenge } from '../src/sim/scenarios';
import { compute } from '../src/sim/compute';
import { compareWeekPlans } from '../src/sim/experiment';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { TestWorker.instances.push(this); }
}
beforeEach(() => { TestWorker.instances = []; vi.stubGlobal('Worker', TestWorker); vi.useFakeTimers(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('后台计算生命周期', () => {
  it('只传入副本所需状态，成功返回后释放Worker与计时器', async () => {
    const state = createWinterChallenge();
    const job = startSimulationJob('week', state);
    const worker = TestWorker.instances[0];
    expect(worker.postMessage).toHaveBeenCalledWith({ kind: 'week', state });
    worker.onmessage!({ data: { ok: true, value: { totalExpanded: 12 } } });
    expect(await job.result).toEqual({ totalExpanded: 12 });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    job.cancel();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('取消会终止计算，迟到结果不能覆盖取消状态', async () => {
    const job = startSimulationJob('policies', createWinterChallenge());
    const rejected = expect(job.result).rejects.toMatchObject({ name: 'AbortError' });
    job.cancel();
    TestWorker.instances[0].onmessage!({ data: { ok: true, value: 'late' } });
    await rejected;
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['error', 'messageerror', 'reported'] as const)('处理 %s，清理资源并允许下次新计算', async kind => {
    const job = startSimulationJob('week', createWinterChallenge());
    const rejected = expect(job.result).rejects.toThrow();
    const worker = TestWorker.instances[0];
    if (kind === 'error') worker.onerror!();
    else if (kind === 'messageerror') worker.onmessageerror!();
    else worker.onmessage!({ data: { ok: false } });
    await rejected;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('超过时间上限后主动终止', async () => {
    const job = startSimulationJob('week', createWinterChallenge());
    const rejected = expect(job.result).rejects.toThrow('60 秒');
    await vi.advanceTimersByTimeAsync(60_000);
    await rejected;
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it('不支持Worker时给出可恢复错误，不改在主线程阻塞计算', async () => {
    vi.stubGlobal('Worker', undefined);
    const job = startSimulationJob('week', createWinterChallenge());
    await expect(job.result).rejects.toThrow('无法启动后台计算');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('后台入口复用原算法，所有非耗时结果一致且不修改输入', () => {
    vi.useRealTimers();
    const state = createWinterChallenge();
    const before = structuredClone(state);
    const withoutTime = (value: unknown) => JSON.parse(JSON.stringify(value, (key, item) => key === 'elapsedMs' ? 0 : item));
    expect(withoutTime(compute({ kind: 'week', state }))).toEqual(withoutTime(compareWeekPlans(state)));
    expect(state).toEqual(before);
    expect(compute({ kind: 'policies', state })).toMatchObject({ available: false });
  });
});
