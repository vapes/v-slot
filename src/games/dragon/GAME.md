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
| `views/DragonHUD.ts` | Values in the baked BALANCE / BET panels; the middle panel is the engine `WinBox` (status line + counting win, BIG+ wins ride onto the reels) at `skin.ui.winBox` |
| `views/DragonSymbols.ts` | `SymbolRenderer`: opaque art tiles; `setValue` draws a sticky cell's cash value (unused now: wilds carry none) |
| `tools/build-reels.mjs` | Builds base + nest strips for real/demo into `strips.json`, exact base RTP per profile (`npm run dragon:reels`) |
| `tools/simulate.ts` | Monte-Carlo of base + feature with the real math (`npm run dragon:sim`) |
| `math/DragonMath.ts` | `MathModel`: base strips + Dragon's Nest sticky respins (pure TS, `@/engine/math` only) |
| `math/respinConfig.ts` | Types of `respin` / math profiles, `buildProfile(raw, strips, mode)` |
| `strips.json` | Generated base + nest strips per profile (`npm run dragon:reels`) |

## Skin pipeline
1. Grid lines / button centres are measured on `art/source.png`; constants live in `slice-skin.py` and `config.json → skin.ui` (both in **source pixels**).
2. `uiAnchor(name)` × `SKIN_SCALE` (540/971) places sprites exactly over the baked art, so a button sprite covers its own picture.
3. Baked value texts are erased in the background (vertical interpolation); buttons are cut from the erased image (the spin wings overlap the LAST WIN panel).
   The mockup's coins and trophy buttons are reused: the coins disc becomes `ui/info.png` (icon inpainted, gold "i" drawn by `draw_info_icon`), the trophy disc becomes `ui/buy.png` (icon inpainted, round egg by `draw_egg_icon`, caption `button.buy` drawn live at `buyLabel`); the trophy is erased from the background (`REMOVED_BUTTONS`, harmonic fill + rock detail from `ROCK_DONOR`).
4. Engine buttons cover the baked top icons: home (`homeButton`) over the hamburger at top-left, sound toggle (`soundButton`) over the speaker at top-right.

## Math — two profiles
`config.ts` picks the profile from `detectPlayMode()`: **demo** (default) or **real** (`?mode=real`). Authored inputs live in `config.json` (real at top level, demo overrides in `demo`); generated strips in `strips.json` (`npm run dragon:reels`, never edit by hand). `{{rtp}}` in the paytable shows the active profile.

**Every paytable combination must be able to land** (CLAUDE.md Hard Rule 9): every paying symbol × 3 and × 4 on the base strips and on the nest strips of both profiles. `dragon:reels` refuses to write strips that break it; `tests/games/dragon.test.ts` checks it with `missingCombosOnStrips`.

| | real | demo |
|---|---|---|
| Base-game RTP (exact) | 62.95% | 59.28% |
| Eggs / Dragons per base reel | 1·2·2·1 / 1·1·1·1 | 2·3·3·2 / 2·2·2·2 |
| Nest trigger (exact) | 1 in 80.7 | 1 in 18.2 |
| Nest reels (per reel) | 3 wilds in ~190 (mostly low cards) | 3 wilds in ~130 (richer) |
| Sticky wilds / respins per feature | ≈2.8 / ≈8.7 | ≈4.3 / ≈10.5 |
| Feature win (× bet): median / mean | 9.5 / 26.7 | 23.5 / 63.9 |
| Features with a MAX banner (≥100× bet) | ≈6% | ≈20% |
| Feature RTP | ≈33.1% | ≈352% |
| **Total RTP** (`rtp` / `demo.rtp`) | **≈96.0%** | **≈411%** |

- Base game: 4×5, 20 lines, **no WILD on the base reels**. **Egg = scatter (1 respin)**, **Dragon Medal = super scatter (3 respins)**; neither pays on lines. Line pays (× line bet) 3/4: chest 300/1500, gold 180/700, crystal 120/400, goblet 80/300, A 24/80, K 20/60, Q 16/50, J 12/40, 10 10/30, 9 8/24 (steep on purpose: wilds pile up in the nest).
- **Dragon's Nest** (`respin`, `math/DragonMath.ts`): 3+ scatters anywhere, any mix (`respin.trigger`). Respins = Σ `respin.scatters[symbol]` (egg 1, dragon 3; e.g. 2 eggs + 1 dragon = 5). The scatters only trigger — **they do not stay and do not turn into wilds**; the nest starts empty. Respins run on the nest strips (`respin.composition` / `demo.respin.composition`: 3 wilds per reel among pay symbols, mostly low cards — **no eggs, no dragons**). Every WILD that lands (`respin.sticky`) sticks to the end and adds `respin.perWild` (**+1**) respins — always, whatever the counter shows — and substitutes on lines. The round ends when the respins run out or all 20 cells hold wilds. Line wins pay on every respin, so the nest is tuned with few wilds per reel: long wild chains (and MAX wins) stay rare. **Wilds pay nothing on their own** (no cash values, no jackpots): the feature pays its line wins only.
- Playback (engine `RespinPlayer`): trigger pulse → window "CONGRATULATIONS! / YOU WON N RESPINS" (`feature.intro`, `feature.won` with plural forms) → respins (every new WILD shoots a comet of sparks into the counter, which ticks up when it lands) → window "TOTAL WIN" + amount (`feature.total`). Windows close by timer (`featureTiming.introMs` / `outroMs`) or a tap.
- **Feature buy** (`buyFeature.cost`, demo: `demo.buyFeature`): **28× bet** in both profiles. `DragonMath.spin({ buyFeature: true })` redraws base spins until 3+ scatters land (natural egg/dragon mix), so a bought round = trigger spin (≈0.4× bet) + nest (≈26.7×) ≈ 27.1× bet → **buy RTP ≈96.7%** real, ≈229% demo (`npm run dragon:sim` prints the "Feature buy" line).
- `build-reels.mjs` enforces: wild never on base strips, scatters never on nest strips, wild present in the nest. Strips are drawn constructively (seeded, no identical neighbours).
- Retune: edit compositions → `npm run dragon:reels` (`-- --strips-only` skips the slow exact base report while only the nest changes) → `npm run dragon:sim -- real` and `-- demo` ("Exact trigger" line + exact base RTP; "Feature win dist" / "Feature banners" show how often features hit BIG…MAX) → update `rtp` / `demo.rtp`, the buy price and this table. `tests/games/dragon.test.ts` fails if MAX banners stop being rare.
- QA: `npm run dev`, `?game=dragon&force=feature` — every spin triggers the nest (dev builds only).

## Story
Night falls over the castle; the mother dragon guards her clutch. Eggs and the rare dragon medals on the reels wake her: each egg buys one respin, each dragon three. In the nest burning WILDs land and stay (sticky), every new one keeps the night going for three more respins, and together they light up the lines. At dawn the nest pays its total win. `setFeatureMode` tints the scene to moonlight while the nest is active.

## Controls
SPIN (hold = turbo loop), − / + (bet), **i** (paytable, bottom-left), AUTO (autoplay toggle), TURBO (quick reels toggle), **BUY** (feature buy, bottom-right: confirmation window → Dragon's Nest), fullscreen, sound on/off (top-right), home (top-left).

## Content CDN
- Paytable: `public/cdn/paytables/dragon/<lang>.html` (en, ru) — HTML template, payouts via `{{pay:ID:N}}`, art via `{{asset:symbols/ID.jpg}}`.
- Translations: `public/cdn/i18n/<lang>/dragon.json` (`game.title`, `symbol.<id>`); lobby title/subtitle in `common.json` (`game.dragon.*`).
- Translated art text: BALANCE / BET captions (the LAST WIN caption is erased too; that panel now holds the win box) and AUTO / TURBO button captions are inpainted out of the art (`tools/slice-skin.py → LABEL_BOXES`) and drawn from i18n keys `label.*` / `button.*` at `skin.ui.*Label` anchors (engine `createSkin` → `skin.label()` / `skin.labelButton()`; `w` = max width, text shrinks to fit).

## Landing animations
Egg and Dragon Medal (the scatters) shimmer as they land: `config.json → symbols[].landing` / `turboLanding` (engine feature, see CLAUDE.md). Egg: 700 ms, 1 light sweep, full hue pass (360°), pop ×1.14; Dragon (super scatter): 850 ms, 1 golden sweep, stronger pop. Turbo variants are about half as long.

## Anticipation
`config.json → anticipation` (engine feature, see CLAUDE.md). Fires on 2 scatters (eggs / dragons) already landed or a HUGE+ line win one symbol away, from reel 3; fire colours. ≈11% of real spins (≈11% of those reach the nest), ≈19% in demo (≈28%). QA: `npm run dev`, `?game=dragon&force=anticipation`.

## Tests
`tests/games/dragon.test.ts` (both profiles, seeded): a bought spin always triggers the nest; wild only in the nest, eggs / dragons only on base strips, grant egg = 1 / dragon = 3, the nest starts empty (scatters do not stay), no scatters in nest steps, sticky wilds stay, +1 respin per new wild, wilds carry no value and totalWin = Σ line wins, same seed → same round; **distribution guard**: MAX-banner features < 10% (real) / < 30% (demo), median feature < 25× / < 50× bet. Engine: `tests/engine/respinStep.test.ts` — every new sticky wild fires a comet and the counter follows.
