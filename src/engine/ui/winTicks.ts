import type { WinCategory } from './WinCelebration';

export const WIN_TIERS: readonly WinCategory[] = ['big', 'huge', 'epic', 'max'];

/** One stretch of the win counter: count up to `to` in `ms`, showing `tier` (null = still in the box). */
export interface TickSegment {
  to: number;
  ms: number;
  tier: WinCategory | null;
}

export interface TickTiming {
  /** Small win: whole count-up. */
  tickMs: number;
  /** Big win: count-up from 0 to the BIG threshold, still in place. */
  climbMs: number;
  /** Big win: one full tier (BIG → HUGE, …). */
  stageMs: number;
  /** Shortest last (partial) stage, as a share of stageMs. */
  minStage: number;
}

/**
 * Win counter plan (pure). A win under the BIG threshold is one quick
 * count-up. A BIG+ win climbs to the BIG threshold, then counts tier by
 * tier — every threshold it passes switches the title (BIG → HUGE → EPIC →
 * MAX) — and the last stretch to `amount` takes a share of a stage
 * proportional to how far it gets into the next tier.
 * `thresholds` are × total bet (cfg.celebration).
 */
export function planWinTicks(
  amount: number, totalBet: number, thresholds: Record<WinCategory, number>, timing: TickTiming,
): TickSegment[] {
  const value = (c: WinCategory) => thresholds[c] * totalBet;
  if (amount < value('big')) return [{ to: amount, ms: timing.tickMs, tier: null }];
  const plan: TickSegment[] = [{ to: value('big'), ms: timing.climbMs, tier: null }];
  for (let i = 0; i < WIN_TIERS.length; i++) {
    const tier = WIN_TIERS[i];
    if (amount < value(tier)) break;
    const next = WIN_TIERS[i + 1];
    const from = value(tier);
    if (next && amount >= value(next)) {
      plan.push({ to: value(next), ms: timing.stageMs, tier });
    } else {
      // last stretch: proportional to the way into the next tier (MAX: a full stage)
      const share = next ? (amount - from) / (value(next) - from) : 1;
      plan.push({ to: amount, ms: timing.stageMs * Math.max(timing.minStage, share), tier });
    }
  }
  return plan;
}
