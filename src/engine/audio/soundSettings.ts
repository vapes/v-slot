const STORAGE_KEY = 'vslot.soundMuted';

type Listener = (muted: boolean) => void;

/**
 * Global sound on/off switch shared by every game, persisted in localStorage.
 * Audio code must check `muted` / subscribe with `onChange` before playing.
 */
class SoundSettings {
  private _muted = read();
  private listeners = new Set<Listener>();

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    if (value === this._muted) return;
    this._muted = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* storage may be unavailable (private mode) — keep the in-memory value */
    }
    this.listeners.forEach(cb => cb(value));
  }

  toggle(): boolean {
    this.muted = !this._muted;
    return this._muted;
  }

  /** Returns an unsubscribe function. */
  onChange(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const soundSettings = new SoundSettings();
