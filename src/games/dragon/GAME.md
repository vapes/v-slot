# Dragon Hoard (`dragon`)

4 reels × 5 rows, 20 lines, portrait mobile skin sliced from one AI mockup. Canvas 540×900, PLN with 2 decimals.

## Files
| Path | Role |
|---|---|
| `art/source.png` | 971×1619 mockup — the single source of all art |
| `tools/slice-skin.py` | Slices the mockup into `public/games/dragon/` (`npm run dragon:slice`) |
| `config.json` | Engine config + `skin.ui` anchors (source px) + `reelComposition` / `reelStacks` / `reels` |
| `config.ts` | Typed config, `SKIN_SCALE`, `uiAnchor()`, `REEL_STRIPS` |
| `assets.ts` | Loads bg, 13 symbol tiles and 8 button sprites |
| `views/DragonView.ts` | `GameView`: background sprite, every button over its baked spot, fullscreen zone |
| `views/SpriteButton.ts` / `SpinButton.ts` | Round sprite buttons (tint when disabled, glow when active) |
| `views/DragonHUD.ts` | Values in the baked BALANCE / LAST WIN / BET panels + message pill |
| `views/DragonSymbols.ts` | `SymbolRenderer`: opaque art tiles |
| `views/DragonPaytable.ts` | Paytable body with symbol art and payouts for the current bet |
| `tools/build-reels.mjs` | Builds strips + exact RTP report (`npm run dragon:reels`) |

## Skin pipeline
1. Grid lines / button centres are measured on `art/source.png`; constants live in `slice-skin.py` and `config.json → skin.ui` (both in **source pixels**).
2. `uiAnchor(name)` × `SKIN_SCALE` (540/971) places sprites exactly over the baked art, so a button sprite covers its own picture.
3. Baked value texts are erased in the background (vertical interpolation); buttons are cut from the erased image (the spin wings overlap the LAST WIN panel).
4. The home button sits over the (decorative) sound icon: `homeButton` in config.

## Math (exact, full enumeration of 11.8M stop combinations)
- WILD stacked ×3 on reels 2–4, substitutes for all, pays nothing itself.
- Pays (× line bet) 3/4 of a kind: dragon 100/1000, egg 60/400, chest 50/250, gold 40/150, crystal 30/100, goblet 25/80, A 15/50, K 12/40, Q 10/35, J 8/25, 10 6/20, 9 5/15.
- RTP 96.198%, hit rate 33.2%, σ 4.19× bet, max 239.85× bet.
- To retune: edit `reelComposition` / `paytable`, run `npm run dragon:reels`, copy the RTP into `config.json → rtp` and this file.

## Controls
SPIN (hold = turbo loop), − / +, coins (cycle bet), AUTO (autoplay toggle), TURBO (quick reels toggle), trophy + menu (paytable), fullscreen, home.

## Timing
Pragmatic Play–style timings (see CLAUDE.md → Timing model): reels start together and land at `spin.stopTimesMs`, quick spin lands everything at `quickStopMs` (450 ms), wins show payline paths with a count-up (`winPresentation`), then lines cycle every 1.3 s.
