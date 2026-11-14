# Dragon Hoard (`dragon`)

4 reels × 5 rows, 20 lines, portrait mobile skin sliced from one AI mockup. Canvas 540×900, PLN with 2 decimals.

## Files
| Path | Role |
|---|---|
| `art/source.png` | 971×1619 mockup — the single source of all art |
| `tools/slice-skin.py` | Slices the mockup into `public/games/dragon/` (`npm run dragon:slice`) |
| `config.json` | Engine config + `skin.ui` anchors (source px) + real math inputs (`reelComposition`, `reelStacks`, `respin`) + `demo` overrides |
| `config.ts` | Typed config, `skin` (engine `createSkin`: `SKIN_SCALE`, `uiAnchor()`, captions), `REEL_STRIPS` |
| `assets.ts` | Loads bg, 13 symbol tiles and 8 button sprites |
| `views/DragonView.ts` | `GameView`: background sprite, engine `SpriteButton`s over their baked spots, fullscreen zone |
| `views/DragonHUD.ts` | Values in the baked BALANCE / LAST WIN / BET panels + message pill |
| `views/DragonSymbols.ts` | `SymbolRenderer`: opaque art tiles; `setValue` draws a sticky dragon's cash value / jackpot |
| `tools/build-reels.mjs` | Builds base + nest strips for real/demo into `strips.json`, exact base RTP per profile (`npm run dragon:reels`) |
| `tools/simulate.ts` | Monte-Carlo of base + feature with the real math (`npm run dragon:sim`) |
| `math/DragonMath.ts` | `MathModel`: base strips + Dragon's Nest sticky respins (pure TS, `@/engine/math` only) |
| `math/respinConfig.ts` | Types of `respin` / math profiles, `buildProfile(raw, strips, mode)` |
| `strips.json` | Generated base + nest strips per profile (`npm run dragon:reels`) |

## Skin pipeline
1. Grid lines / button centres are measured on `art/source.png`; constants live in `slice-skin.py` and `config.json → skin.ui` (both in **source pixels**).
2. `uiAnchor(name)` × `SKIN_SCALE` (540/971) places sprites exactly over the baked art, so a button sprite covers its own picture.
3. Baked value texts are erased in the background (vertical interpolation); buttons are cut from the erased image (the spin wings overlap the LAST WIN panel).
4. Engine buttons cover the baked top icons: home (`homeButton`) over the hamburger at top-left, sound toggle (`soundButton`) over the speaker at top-right.

## Math — two profiles
`config.ts` picks the profile from `detectPlayMode()`: **demo** (default) or **real** (`?mode=real`). Authored inputs live in `config.json` (real at top level, demo overrides in `demo`); generated strips in `strips.json` (`npm run dragon:reels`, never edit by hand). `{{rtp}}` in the paytable shows the active profile.

| | real | demo |
|---|---|---|
| Base-game RTP (exact) | 62.74% | 57.61% |
| Eggs per base reel | 1 / 2 / 2 / 1 | 3 / 3 / 3 / 3 |
| Nest trigger (exact) | 1 in 123.4 | 1 in 13.7 |
| Mean feature win | 41.2× bet | 47.7× bet |
| Feature RTP | ≈33.4% | ≈347.8% |
| **Total RTP** (`rtp` / `demo.rtp`) | **≈96.2%** | **≈405%** |

- Base game: 4×5, 20 lines, WILD stacked ×3 on reels 2–4 (substitutes, pays nothing). **No Dragon Medal on the base reels.** **Egg = scatter** (no line pays). Line pays (× line bet) 3/4: chest 40/200, gold 30/120, crystal 22/75, goblet 18/60, A 11/38, K 9/30, Q 7/26, J 6/19, 10 5/15, 9 4/11.
- **Dragon's Nest** (`respin`, `math/DragonMath.ts`): 3+ eggs anywhere. The eggs hatch: each trigger position becomes a sticky **Dragon** (`respin.sticky`). Respins run on the nest strips (`respin.composition`: dragon, wild, chest, gold, crystal, goblet — **no eggs, no low cards**). Every Dragon is **sticky** with a value from `respin.values` (1×–25× total bet, MINI 50×, MAJOR 150×; demo uses `demo.respin.values`, richer); a new Dragon resets respins to 3; line wins pay on every respin; all 20 cells = GRAND HOARD +1000× bet.
- `build-reels.mjs` enforces: dragon never on base strips, egg never on nest strips.
- Retune: edit compositions / values → `npm run dragon:reels` → `npm run dragon:sim -- real` and `-- demo` (use the "Exact trigger" line + exact base RTP) → update `rtp` / `demo.rtp` and this table.
- QA: `npm run dev`, `?game=dragon&force=feature` — every spin triggers the nest (dev builds only).

## Story
Night falls over the castle; the mother dragon guards her clutch. The triggering eggs hatch into young dragons, her fire burns away the low cards, and every dragon that lands stays in the nest (sticky) carrying treasure; each new dragon buys three more respins. At dawn the dragons bring their treasure home — fill the whole nest and wake the GRAND HOARD. `setFeatureMode` tints the scene to moonlight while the nest is active.

## Controls
SPIN (hold = turbo loop), − / +, coins (cycle bet), AUTO (autoplay toggle), TURBO (quick reels toggle), trophy (paytable), fullscreen, sound on/off (top-right), home (top-left).

## Content CDN
- Paytable: `public/cdn/paytables/dragon/<lang>.html` (en, ru) — HTML template, payouts via `{{pay:ID:N}}`, art via `{{asset:symbols/ID.jpg}}`.
- Translations: `public/cdn/i18n/<lang>/dragon.json` (`game.title`, `symbol.<id>`); lobby title/subtitle in `common.json` (`game.dragon.*`).
- Translated art text: BALANCE / LAST WIN / BET captions and AUTO / TURBO button captions are inpainted out of the art (`tools/slice-skin.py → LABEL_BOXES`) and drawn from i18n keys `label.*` / `button.*` at `skin.ui.*Label` anchors (engine `createSkin` → `skin.label()` / `skin.labelButton()`; `w` = max width, text shrinks to fit).

## Anticipation
`config.json → anticipation` (engine feature, see CLAUDE.md). Fires on 2 eggs already landed (scatter tease) or a HUGE+ line win one symbol away, from reel 3; fire colours. ≈6.8% of real spins (≈11% of those reach the nest), ≈19% in demo. QA: `npm run dev`, `?game=dragon&force=anticipation`.

## Tests
`tests/games/dragon.test.ts` (both profiles, seeded): dragon never on base strips / egg never in the nest, triggering eggs become sticky dragons, sticky cells stay, respins reset/count down, totals add up, values come from the table, same seed → same round.
