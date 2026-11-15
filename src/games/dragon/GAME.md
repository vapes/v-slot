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

| | real | demo |
|---|---|---|
| Base-game RTP (exact) | 63.55% | 60.39% |
| Eggs / Dragons per base reel | 1·1·2·1 / 1·1·1·1 | 2·2·2·2 / 2·2·2·2 |
| Nest trigger (exact) | 1 in 230.0 | 1 in 25.0 |
| Mean feature win (line wins only) | 75.0× bet | 89.6× bet |
| Feature RTP | ≈32.6% | ≈358% |
| **Total RTP** (`rtp` / `demo.rtp`) | **≈96.1%** | **≈418%** |

- Base game: 4×5, 20 lines, **no WILD on the base reels**. **Egg = scatter (1 respin)**, **Dragon Medal = super scatter (3 respins)**; neither pays on lines. Line pays (× line bet) 3/4: chest 300/1500, gold 180/700, crystal 120/400, goblet 80/300, A 24/80, K 20/60, Q 16/50, J 12/40, 10 10/30, 9 8/24 (steep on purpose: wilds pile up in the nest).
- **Dragon's Nest** (`respin`, `math/DragonMath.ts`): 3+ scatters anywhere, any mix (`respin.trigger`). Respins = Σ `respin.scatters[symbol]` (egg 1, dragon 3; e.g. 2 eggs + 1 dragon = 5). The scatters only trigger — **they do not stay and do not turn into wilds**; the nest starts empty. Respins run on the nest strips (`respin.composition`, demo: `demo.respin.composition`: 2 wilds per reel + pay symbols — **no eggs, no dragons**). A WILD that lands (`respin.sticky`) sticks to the end, tops the counter up to `respin.respins` (3) — `max(left − 1, 3)`, never lowers it — and substitutes on lines. **Wilds pay nothing on their own** (no cash values, no jackpots): the feature pays its line wins only.
- Playback (engine `RespinPlayer`): trigger pulse → window "CONGRATULATIONS! / YOU WON N RESPINS" (`feature.intro`, `feature.won` with plural forms) → respins (a new WILD that adds respins shoots a comet of sparks into the counter, which ticks up when it lands) → window "TOTAL WIN" + amount (`feature.total`). Windows close by timer (`featureTiming.introMs` / `outroMs`) or a tap.
- **Feature buy** (`buyFeature.cost`, demo: `demo.buyFeature`): **78× bet** in both profiles. `DragonMath.spin({ buyFeature: true })` redraws base spins until 3+ scatters land (natural egg/dragon mix), so a bought round = trigger spin (≈0.5× bet) + nest (≈74.7×) ≈ 75.2× bet → **buy RTP ≈96.4%** real, ≈114% demo (`npm run dragon:sim` prints the "Feature buy" line).
- `build-reels.mjs` enforces: wild never on base strips, scatters never on nest strips, wild present in the nest. Strips are drawn constructively (seeded, no identical neighbours).
- Retune: edit compositions / values → `npm run dragon:reels` → `npm run dragon:sim -- real` and `-- demo` (use the "Exact trigger" line + exact base RTP) → update `rtp` / `demo.rtp` and this table.
- QA: `npm run dev`, `?game=dragon&force=feature` — every spin triggers the nest (dev builds only).

## Story
Night falls over the castle; the mother dragon guards her clutch. Eggs and the rare dragon medals on the reels wake her: each egg buys one respin, each dragon three. In the nest burning WILDs land and stay (sticky), every new one keeps the night going for three more respins, and together they light up the lines. At dawn the nest pays its total win. `setFeatureMode` tints the scene to moonlight while the nest is active.

## Controls
SPIN (hold = turbo loop), − / + (bet), **i** (paytable, bottom-left), AUTO (autoplay toggle), TURBO (quick reels toggle), **BUY** (feature buy, bottom-right: confirmation window → Dragon's Nest), fullscreen, sound on/off (top-right), home (top-left).

## Content CDN
- Paytable: `public/cdn/paytables/dragon/<lang>.html` (en, ru) — HTML template, payouts via `{{pay:ID:N}}`, art via `{{asset:symbols/ID.jpg}}`.
- Translations: `public/cdn/i18n/<lang>/dragon.json` (`game.title`, `symbol.<id>`); lobby title/subtitle in `common.json` (`game.dragon.*`).
- Translated art text: BALANCE / LAST WIN / BET captions and AUTO / TURBO button captions are inpainted out of the art (`tools/slice-skin.py → LABEL_BOXES`) and drawn from i18n keys `label.*` / `button.*` at `skin.ui.*Label` anchors (engine `createSkin` → `skin.label()` / `skin.labelButton()`; `w` = max width, text shrinks to fit).

## Landing animations
Egg and Dragon Medal (the scatters) shimmer as they land: `config.json → symbols[].landing` / `turboLanding` (engine feature, see CLAUDE.md). Egg: 700 ms, 1 light sweep, full hue pass (360°), pop ×1.14; Dragon (super scatter): 850 ms, 1 golden sweep, stronger pop. Turbo variants are about half as long.

## Anticipation
`config.json → anticipation` (engine feature, see CLAUDE.md). Fires on 2 scatters (eggs / dragons) already landed or a HUGE+ line win one symbol away, from reel 3; fire colours. ≈8.6% of real spins (≈5% of those reach the nest), ≈16% in demo (≈24%). QA: `npm run dev`, `?game=dragon&force=anticipation`.

## Tests
`tests/games/dragon.test.ts` (both profiles, seeded): a bought spin always triggers the nest; wild only in the nest, eggs / dragons only on base strips, grant egg = 1 / dragon = 3, the nest starts empty (scatters do not stay), no scatters in nest steps, sticky wilds stay, top-up rule, wilds carry no value and totalWin = Σ line wins, same seed → same round.
