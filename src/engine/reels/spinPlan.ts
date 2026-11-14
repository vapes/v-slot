import type { SlotConfig } from '../config/SlotConfig';

const FRAME_MS = 1000 / 60;

/**
 * How many blur screens a reel must scroll so it lands `durationMs` after it
 * starts. Mirrors Reel's motion: normal = bounce-up, then linear acceleration
 * to spinSpeed; fast = constant spinSpeed × turboSpeedMultiplier.
 * The last screen is the target screen, hence the −1.
 */
export function screensForDuration(cfg: SlotConfig, durationMs: number, fast: boolean): number {
  const s = cfg.spin;
  const frames = durationMs / FRAME_MS;
  let distance: number;
  if (fast) {
    distance = s.spinSpeed * s.turboSpeedMultiplier * frames;
  } else {
    const accFrames = s.spinSpeed / s.acceleration;
    const cruise = Math.max(0, frames - s.bounceUp.duration - accFrames);
    distance = (s.spinSpeed * s.spinSpeed) / (2 * s.acceleration) + s.spinSpeed * cruise;
  }
  return Math.max(0, distance / cfg.reelAreaHeight - 1);
}

/** Per-reel { delayMs, screens } for a normal or fast spin. */
export function planSpin(cfg: SlotConfig, fast: boolean): { delayMs: number; screens: number }[] {
  const { stopTimesMs, quickStopMs, scrollScreens, reelStartInterval } = cfg.spin;
  return Array.from({ length: cfg.grid.cols }, (_, i) => {
    if (fast) {
      return { delayMs: 0, screens: quickStopMs ? screensForDuration(cfg, quickStopMs, true) : 1 };
    }
    const delayMs = i * reelStartInterval;
    if (stopTimesMs) {
      return { delayMs, screens: screensForDuration(cfg, stopTimesMs[i] - delayMs, false) };
    }
    return { delayMs, screens: scrollScreens?.[i] ?? i + 1 };
  });
}
