import type { FeatureStep, StickyCell } from '../math/types';

/** What the player sees after one respin lands (pure, unit-tested). */
export interface RespinStepPlan {
  /** Every new sticky cell fires a comet into the respin counter. */
  fly: StickyCell[];
  /** Counter value shown while the reels spin (one respin used). */
  during: number;
  /** Counter value after the step (after the comets land). */
  after: number;
  /** The counter grew on this step → bounce it when the comets land. */
  pop: boolean;
}

export function planRespinStep(respinsBefore: number, step: FeatureStep): RespinStepPlan {
  const during = respinsBefore - 1;
  return { fly: step.newSticky, during, after: step.respinsLeft, pop: step.respinsLeft > during };
}
