import { compareWeekPlans } from './experiment';
import { comparePolicies } from './policies';
import type { RunState } from './types';

export interface Computations {
  week: ReturnType<typeof compareWeekPlans>;
  policies: ReturnType<typeof comparePolicies>;
}
export type ComputationKind = keyof Computations;
export type ComputationRequest = { kind: ComputationKind; state: RunState };

/** Both browser workers and regression tests call the same production kernel. */
export function compute(request: ComputationRequest): Computations[ComputationKind] {
  return request.kind === 'week' ? compareWeekPlans(request.state) : comparePolicies(request.state);
}
