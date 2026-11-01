import { compute } from './compute';
import type { ComputationRequest } from './compute';

self.onmessage = (event: MessageEvent<ComputationRequest>) => {
  try { self.postMessage({ ok: true, value: compute(event.data) }); }
  catch { self.postMessage({ ok: false }); }
};
