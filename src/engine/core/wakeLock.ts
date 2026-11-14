/**
 * Keeps the device screen awake while a game is open (Screen Wake Lock API).
 *
 * The browser drops the lock whenever the tab is hidden, so it is requested
 * again on every return to the tab, and on the first user gesture for
 * browsers that only grant it after interaction. Unsupported browsers
 * (e.g. iOS Safari before 16.4) simply keep their normal sleep behaviour.
 */
export function keepScreenAwake(): void {
  if (!('wakeLock' in navigator)) {
    console.info('[wakeLock] Screen Wake Lock API not supported');
    return;
  }

  let sentinel: WakeLockSentinel | null = null;
  let pending = false;

  const acquire = async () => {
    if (pending || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
    pending = true;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      console.info('[wakeLock] screen kept awake');
    } catch (err) {
      console.info('[wakeLock] request refused:', err);
    } finally {
      pending = false;
    }
  };

  document.addEventListener('visibilitychange', () => void acquire());
  // Some browsers grant the lock only after a user gesture; retry on taps/keys.
  window.addEventListener('pointerdown', () => void acquire());
  window.addEventListener('keydown', () => void acquire());
  void acquire();
}
