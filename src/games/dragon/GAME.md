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
| `views/DragonSymbols.ts` | `SymbolRenderer`: opaque art tiles; `setValue` draws a sticky wild's cash value / jackpot |
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
| Base-game RTP (exact) | 63.55% | 60.39% |
| Eggs / Dragons per base reel | 1·1·2·1 / 1·1·1·1 | 2·2·2·2 / 2·2·2·2 |
| Nest trigger (exact) | 1 in 230.0 | 1 in 25.0 |
| Mean feature win | 74.0× bet | 86.9× bet |
| Feature RTP | ≈32.2% | ≈347.3% |
| **Total RTP** (`rtp` / `demo.rtp`) | **≈95.7%** | **≈408%** |

- Base game: 4×5, 20 lines, **no WILD on the base reels**. **Egg = scatter (1 respin)**, **Dragon Medal = super scatter (3 respins)**; neither pays on lines. Line pays (× line bet) 3/4: chest 300/1500, gold 180/700, crystal 120/400, goblet 80/300, A 24/80, K 20/60, Q 16/50, J 12/40, 10 10/30, 9 8/24 (steep on purpose: premiums carry the base game, the nest is mostly low symbols).
- **Dragon's Nest** (`respin`, `math/DragonMath.ts`): 3+ scatters anywhere, any mix (`respin.trigger`). Initial respins = Σ `respin.scatters[symbol]` (egg 1, dragon 3; e.g. 2 eggs + 1 dragon = 5). Each trigger position becomes a sticky **WILD** (`respin.sticky`) with a value from `respin.values` (2×–40× total bet, MINI 75×, MAJOR 250×; demo uses the same ladder with richer weights in `demo.respin.values`). Respins run on the nest strips (`respin.composition`: wild + all pay symbols, mostly low — **no eggs, no dragons**). A new WILD sticks with a value and tops the counter up to `respin.respins` (3) — `max(left − 1, 3)`, never lowers it. Sticky WILDs substitute on lines; line wins pay on every respin; all 20 cells = GRAND HOARD +1000× bet.
- `build-reels.mjs` enforces: wild never on base strips, scatters never on nest strips, wild present in the nest. Strips are drawn constructively (seeded, no identical neighbours).
- Retune: edit compositions / values → `npm run dragon:reels` → `npm run dragon:sim -- real` and `-- demo` (use the "Exact trigger" line + exact base RTP) → update `rtp` / `demo.rtp` and this table.
- QA: `npm run dev`, `?game=dragon&force=feature` — every spin triggers the nest (dev builds only).

## Story
Night falls over the castle; the mother dragon guards her clutch. Eggs and the rare dragon medals on the reels wake her: each egg buys one respin, each dragon three. In the nest every scatter turns into a burning WILD that stays (sticky) carrying treasure; each new wild keeps the night going for three more respins. At dawn the wilds bring their treasure home — fill the whole nest and wake the GRAND HOARD. `setFeatureMode` tints the scene to moonlight while the nest is active.

## Controls
SPIN (hold = turbo loop), − / +, coins (cycle bet), AUTO (autoplay toggle), TURBO (quick reels toggle), trophy (paytable), fullscreen, sound on/off (top-right), home (top-left).

## Content CDN
- Paytable: `public/cdn/paytables/dragon/<lang>.html` (en, ru) — HTML template, payouts via `{{pay:ID:N}}`, art via `{{asset:symbols/ID.jpg}}`.
- Translations: `public/cdn/i18n/<lang>/dragon.json` (`game.title`, `symbol.<id>`); lobby title/subtitle in `common.json` (`game.dragon.*`).
- Translated art text: BALANCE / LAST WIN / BET captions and AUTO / TURBO button captions are inpainted out of the art (`tools/slice-skin.py → LABEL_BOXES`) and drawn from i18n keys `label.*` / `button.*` at `skin.ui.*Label` anchors (engine `createSkin` → `skin.label()` / `skin.labelButton()`; `w` = max width, text shrinks to fit).

## Anticipation
`config.json → anticipation` (engine feature, see CLAUDE.md). Fires on 2 scatters (eggs / dragons) already landed or a HUGE+ line win one symbol away, from reel 3; fire colours. ≈8.5% of real spins (≈5% of those reach the nest), ≈16% in demo (≈25%). QA: `npm run dev`, `?game=dragon&force=anticipation`.

## Tests
`tests/games/dragon.test.ts` (both profiles, seeded): wild only in the nest, eggs / dragons only on base strips, grant egg = 1 / dragon = 3, triggering scatters become sticky wilds, no scatters in nest steps, top-up rule, totals add up, values come from the table, same seed → same round.
