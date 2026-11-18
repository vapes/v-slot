import type { GameManifest } from '@/engine';
import { manifest as dragon } from './dragon/manifest';
import { manifest as classic } from './classic/manifest';
import { manifest as crystal } from './crystal/manifest';
// @new-game-import (scaffold inserts imports above this line)

/** Lobby order. Each game bundle is code-split and loaded on demand. */
export const GAMES: GameManifest[] = [
  dragon,
  classic,
  crystal,
  // @new-game-entry (scaffold inserts entries above this line)
];
