/**
 * Play mode of the session. There is no real-money backend yet, so the
 * platform runs in "demo" by default; `?mode=real` selects the certified
 * ("real") math profile of games that ship one. Games choose their math
 * profile from this in config.ts; the paytable shows that profile's RTP.
 */
export type PlayMode = 'demo' | 'real';

export function detectPlayMode(): PlayMode {
  return new URLSearchParams(window.location.search).get('mode') === 'real' ? 'real' : 'demo';
}
