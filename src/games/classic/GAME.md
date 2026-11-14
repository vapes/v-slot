# V-Slot Classic (`classic`)

The original V-Slot: 5 reels × 3 rows, 20 lines, flat Graphics art (coloured tiles with letters V/A/P/E/S). Canvas 540×960, credits without decimals.

## Files
| Path | Role |
|---|---|
| `config.json` | Engine config + `reels` (strips used only by the generator) + `payoutDistribution` |
| `config.ts` | Typed config, `SYMBOL_COLORS`, `PAYOUT_PROBABILITIES` |
| `math/ClassicMath.ts` | `MathModel`: picks a payout category, then a grid from `screens.bin` |
| `math/PrecomputedTable.ts` | Parses `public/games/classic/screens.bin` (nibble-packed grids grouped by category) |
| `views/ClassicView.ts` | `GameView`: spin button, ± bet, HUD, "i" InfoButton (bottom-left) |
| `views/ClassicSymbols.ts` | `SymbolRenderer`: coloured rounded rect + letter |
| `views/ClassicHUD.ts` | Status / WIN text, line info, Balance + Bet row |
| `views/ClassicPaytable.ts` | Paytable body (engine `pt*` blocks) |
| `tools/generate-screens.mjs` | Builds `screens.bin` from `config.json` (`npm run classic:screens`) |

## Math
- No wild. Pays 3/4/5 of a kind × line bet, line bet = total bet / 20.
- Outcome category is drawn from `payoutDistribution` (lose 72%, small 20%, …, max 0.02%); `screens.bin` holds 100 000 real grids per category mix, calibrated by the generator to `rtp` 0.98.
- **After changing paytable, reels, paylines, symbols or payoutDistribution, rerun `npm run classic:screens`** — the table must match the config or wins will look inconsistent.

## Notes
- Money: `currency.decimals = 0`, so minor units are credits (start 10 000, bets 20…2000).
- Celebration thresholds are low (BIG ≥ 2× bet) on purpose — matches the original game.
- This game is the default template for `npm run new-game`.

## Timing
Pragmatic Play–style timings (see CLAUDE.md → Timing model): reels start together and land at `spin.stopTimesMs`, quick spin lands everything at `quickStopMs` (450 ms), wins show payline paths with a count-up (`winPresentation`), then lines cycle every 1.3 s.
