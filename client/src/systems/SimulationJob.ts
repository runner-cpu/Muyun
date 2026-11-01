import type { ComputationKind, Computations } from '../sim/compute';
import type { RunState } from '../sim/types';

export interface SimulationJob<T> { result: Promise<T>; cancel(): void }

/** One owned worker per request: closing a panel actually stops the computation. */
export function startSimulationJob<K extends ComputationKind>(kind: K, state: RunState): SimulationJob<Computations[K]> {
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  let rejectResult: (error: Error) => void = () => undefined;
  const dispose = () => { if (timer) clearTimeout(timer); worker?.terminate(); };
  const fail = (error: Error) => {
    if (finished) return;
    finished = true;
    dispose();
    rejectResult(error);
  };
  const result = new Promise<Computations[K]>((resolve, reject) => {
    rejectResult = reject;
    try {
      worker = new Worker(new URL('../sim/compute.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent) => {
        if (finished) return;
        if (event.data?.ok !== true) { fail(new Error('计算未完成，请重新运行。')); return; }
        finished = true;
        dispose();
        resolve(event.data.value);
      };
      worker.onerror = () => fail(new Error('计算模块加载失败，请检查网络后重试。'));
      worker.onmessageerror = () => fail(new Error('计算结果无法读取，请重新运行。'));
      timer = setTimeout(() => fail(new Error('本次计算超过 60 秒，已停止。可以重试或先导出实际记录。')), 60_000);
      worker.postMessage({ kind, state });
    } catch { fail(new Error('当前浏览器无法启动后台计算，请使用支持 Worker 的浏览器。')); }
  });
  return { result, cancel: () => fail(new DOMException('计算已取消。', 'AbortError')) };
}
