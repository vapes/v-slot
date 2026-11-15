import { gameEvents, type GameEventMap } from './GameEvents';

export interface QaApi {
  /** Press SPIN (same as the button / spacebar). */
  spin(): void;
  openPaytable(): void;
  closePaytable(): void;
  state(): { balance: number; totalBet: number; spinning: boolean };
  /** Every game event since load, oldest first. */
  events: { name: keyof GameEventMap; at: number }[];
}

/**
 * Dev builds only: exposes `window.__vslot` so scripts/qa.cjs (Playwright)
 * and agents can drive a game and wait on real events instead of sleeps.
 */
export function installQaHooks(api: Omit<QaApi, 'events'>): void {
  if (!import.meta.env.DEV) return;
  const events: QaApi['events'] = [];
  const names: (keyof GameEventMap)[] = [
    'spinStart', 'reelLand', 'symbolLanding', 'reelsStopped', 'anticipationStart', 'anticipationEnd',
    'featureStart', 'featureStep', 'featureEnd', 'win', 'balance', 'betChange', 'autoplay', 'quickSpin',
  ];
  names.forEach(name => gameEvents.on(name, () => events.push({ name, at: performance.now() })));
  (window as unknown as { __vslot: QaApi }).__vslot = { ...api, events };
}
