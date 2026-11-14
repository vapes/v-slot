# 777 Casino Classic (`classic`)

5 reels × 3 rows, 20 lines, fruit-machine skin sliced from one mockup ("777 Casino Classic"). Canvas 540×968, USD shown as `$5,420.50` (minor units = cents).

## Files
| Path | Role |
|---|---|
| `art/source.jpg` | 1536×2752 mockup — the single source of all art |
| `tools/slice-skin.py` | Slices the mockup into `public/games/classic/` (`npm run classic:slice`) |
| `tools/generate-screens.mjs` | Builds `screens.bin` from `config.json` (`npm run classic:screens`) |
| `config.json` | Engine config + `skin.ui` anchors (source px) + `skin.jackpot` + `reels` (generator only) + `payoutDistribution` |
| `config.ts` | Typed config, `skin` (engine `createSkin`: `SKIN_SCALE`, `uiAnchor()`, captions), `JACKPOT`, `PAYOUT_PROBABILITIES` |
| `assets.ts` | Loads bg, 6 symbol tiles and 6 button sprites |
| `math/ClassicMath.ts` | `MathModel`: picks a payout category, then a grid from `screens.bin` |
| `math/PrecomputedTable.ts` | Parses `screens.bin` (nibble-packed grids grouped by category) |
| `views/ClassicView.ts` | `GameView`: background, spin / ± / AUTO SPIN / TURBO / i buttons over their baked spots |
| `views/ClassicHUD.ts` | BALANCE / BET / WIN values, message pill under the reels, jackpot meter |
| `views/JackpotTicker.ts` | Decorative MEGA JACKPOT meter (`skin.jackpot`, not part of the math) |
| `views/ClassicSymbols.ts` | `SymbolRenderer`: opaque art tiles |

## Skin pipeline
Same approach as `dragon`: grid lines and button centres measured on `art/source.jpg`; anchors in **source pixels** (`skin.ui`), `uiAnchor()` × `SKIN_SCALE` (540/1536) puts each sprite exactly over its baked picture. Value texts and the jackpot amount are erased from the background and drawn live. Only vertical reel separators (`reelStyle.separators.rows: false`), as in the mockup. Home (top-left) and sound (top-right) are engine buttons.

## Math
- Symbols (high → low): seven, bar, bell, star, melon, cherry. No wild. Pays 3/4/5 of a kind × line bet (line bet = total bet / 20): seven 50/185/900, bar 25/90/450, bell 14/45/225, star 10/30/140, melon 9/22/95, cherry 5/10/45.
- Outcome category is drawn from `payoutDistribution` (lose 72%, small 20%, medium 5%, big 2%, huge 0.8%, epic 0.18%, max 0.02%); `screens.bin` holds real grids per category, calibrated by the generator: **RTP 97.99%**, hit rate 28%.
- `screens.bin` stores symbols by their index in `config.symbols` — **after changing symbols, their order, paytable, reels, paylines or payoutDistribution, rerun `npm run classic:screens`.**

## Controls
SPIN (hold = turbo loop), − / +, AUTO SPIN (autoplay toggle), TURBO (quick reels toggle; the mockup's INFO button with a translated caption), i (paytable, top-right under sound), sound on/off (top-right), home (top-left). The mockup's bottom-row "i" and speaker are erased from the background (`REMOVED_BUTTONS` in the slicer).

## Content CDN
- Paytable: `public/cdn/paytables/classic/<lang>.html` (en, ru) — HTML template, payouts via `{{pay:ID:N}}`, art via `{{asset:symbols/ID.jpg}}`.
- Translations: `public/cdn/i18n/<lang>/classic.json` (`game.title`, `symbol.<id>`); lobby title/subtitle in `common.json` (`game.classic.*`).
- Translated art text: MEGA JACKPOT, BALANCE / BET / WIN captions and SPIN / AUTO SPIN / TURBO button captions are inpainted out of the art (`tools/slice-skin.py → LABEL_BOXES`) and drawn from i18n keys `label.*` / `button.*` at `skin.ui.*Label` anchors (engine `createSkin` → `skin.label()` / `skin.labelButton()`; `w` = max width, text shrinks to fit).

## Anticipation
`config.json → anticipation` (engine feature, see CLAUDE.md). Fires when a HUGE+ (≥5× bet) line win is one symbol away, from reel 3 (no scatter in this game). Style `marquee`: a thin gold frame with chasing casino bulbs, light veil (0.12) — deliberately lighter than dragon's flames. ≈10% of spins. QA: `npm run dev`, `?game=classic&force=anticipation`.

## Tests
`tests/games/classic.test.ts`: `screens.bin` decodes to 5×3 grids of config symbols and the losing share matches `payoutDistribution` (seeded).
