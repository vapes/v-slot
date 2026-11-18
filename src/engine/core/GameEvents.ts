import type { FeatureRound, FreeSpinsRound, SpinResult } from '../math/types';

/**
 * Everything observable that happens in a game, for audio, analytics,
 * tutorials, tests and agents. Subscribe with `gameEvents.on(name, cb)`;
 * the engine emits, games and add-ons only listen. Money in minor units.
 */
export interface GameEventMap {
  /** Spin accepted, stake deducted (`buy`: bought feature, `stake` = its price). */
  spinStart: { totalBet: number; turbo: boolean; quick: boolean; buy: boolean; stake: number };
  /** A reel landed on its symbols (before its bounce). */
  reelLand: { reel: number };
  /** A symbol with a landing animation landed (one per cell; `turbo` = turbo variant). */
  symbolLanding: { reel: number; row: number; symbol: string; turbo: boolean };
  /** All reels stopped; result known (wins not yet presented). */
  reelsStopped: { result: SpinResult };
  anticipationStart: { reel: number };
  anticipationEnd: { reel: number };
  featureStart: { feature: FeatureRound | FreeSpinsRound };
  /** Drop mode: one cascade started (`win` in minor units). */
  tumble: { index: number; win: number };
  /** Drop mode: multiplier cells applied to the spin's tumble win. */
  multiplier: { applied: number; sum: number };
  /** One respin / free spin finished. */
  featureStep: { index: number; newSticky: number; respinsLeft: number };
  featureEnd: { totalWin: number };
  /** Spin finished with a win (base + feature). */
  win: { amount: number; totalBet: number; category: string | null };
  /** Win box: the counter passed a tier threshold (BIG → HUGE → …) / finished counting. */
  winTier: { category: string };
  winCountEnd: { amount: number };
  balance: { balance: number };
  betChange: { totalBet: number };
  autoplay: { on: boolean };
  quickSpin: { on: boolean };
}

type Listener<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;

export class GameEvents {
  private listeners = new Map<keyof GameEventMap, Set<Listener<never>>>();

  /** Returns an unsubscribe function. */
  on<K extends keyof GameEventMap>(name: K, cb: Listener<K>): () => void {
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    set.add(cb as Listener<never>);
    return () => set!.delete(cb as Listener<never>);
  }

  emit<K extends keyof GameEventMap>(name: K, payload: GameEventMap[K]): void {
    this.listeners.get(name)?.forEach(cb => {
      try {
        (cb as Listener<K>)(payload);
      } catch (err) {
        console.error(`[gameEvents] listener for "${name}" failed:`, err);
      }
    });
  }
}

/** One game per page → one shared bus. */
export const gameEvents = new GameEvents();
