# Crystal Falls (`crystal`)

6 reels × 5 rows, **pay anywhere**, **drop mode** (no spinning reels: gems fall in like pebbles and tumble), power-orb multipliers, prism free spins. Canvas 540×968, USD with 2 decimals. Original theme in the "tumble + pay anywhere + multiplier orbs" genre.

The mechanics are engine features switched on by config; the game itself is art, config and its math:

| Engine feature | Switched on by |
|---|---|
| Falling columns + cascades (`reels/DropReel`, `drop/TumblePlayer`) | `config.drop` (timings over `DROP_DEFAULTS`) |
| Pay anywhere, bet unit = total bet (`math/payAnywhere`) | `config.payMode = "anywhere"`, `paylines: []` |
| Cascade resolver (`runTumbles` / `collapseGrid`) | used by `math/CrystalMath.ts` |
| Cells with values ("mult:25" → orb with ×25 caption) | `withValue` in the math, `SymbolView.setValue` in `views/CrystalSymbols.ts` |
| Multiplier fly-in, free-spins round (`drop/FreeSpinsPlayer`) | `SpinResult.multiplier` / `SpinResult.freeSpins` from the math |

## Files
| Path | Role |
|---|---|
| `config.json` | Engine config + `skin.ui` anchors (art px, 1080 wide = 2× canvas) + `math` (weights, orb values, free spins) |
| `config.ts` | Typed config (+ `maxWin`), `MATH`, `skin` (`createSkin`) |
| `assets.ts` | Loads bg, 11 symbol PNGs, 7 button sprites |
| `math/CrystalMath.ts` | `MathModel`: independent weighted cells, tumbles, orbs, prism pay, free spins, buy, max-win cap (pure) |
| `math/profile.ts` | Math config types + weighted picker |
| `views/CrystalView.ts` | `GameView`: background, `SpriteButton`s at their anchors, free-spins tint |
| `views/CrystalHUD.ts` | BALANCE / BET plates + win box layout and styles |
| `views/CrystalSymbols.ts` | `SymbolRenderer`: transparent gem sprites; orb value caption |
| `tools/draw-symbols.py`, `tools/draw-skin.py`, `tools/art_lib.py` | Procedural art (Pillow): symbols, background with plates/logo, buttons (`npm run crystal:art`). Plates and buttons are placed from `config.json → skin.ui`, so move an anchor and re-run |
| `tools/simulate.ts` | Monte-Carlo with the real math (`npm run crystal:sim`) |

## Rules (math)
- Every cell is an independent draw from `math.base.weights` (free spins: `math.free.weights`). `mult` cells get a value from `multipliers`.
- 8+ of a symbol anywhere pay (`paytable`: keys 8 / 10 / 12 = 8–9 / 10–11 / 12+), × total bet. Winning cells burst, the rest falls, new cells drop in; repeat while something pays. Prisms (`scatter`) and orbs never pay as a cluster and never burst.
- Base game: if the spin won, the orbs on the final screen add up and multiply the tumble win.
- 4+ prisms on the final screen pay `paytable.scatter` (4 / 5 / 6+) and start 15 free spins. In free spins the orb sum of every winning spin adds to a total multiplier that multiplies every winning free spin from then on; 3+ prisms add 5 spins.
- Max win `maxWin` = 5 000× bet (the free spins end when reached).
- Feature buy: `buyFeature.cost` = 135× bet; the bought screen gets prisms on 4 distinct reels.

## RTP (`npm run crystal:sim`, 3M spins + 50k bought features)
| | |
|---|---|
| Base (tumbles, orbs, prism pay) | ≈ 63.1% (hit rate 34.5%) |
| Free spins | 1 in ≈ 387 spins, mean round ≈ 126× bet → ≈ 32.7% |
| **Total** | **≈ 95.8%** (config `rtp` 0.96) |
| Feature buy at 135× | ≈ 96.3% |

One profile only (real ≈ 96% in demo and real mode). After changing weights / paytable / free spins: re-run the simulator, update `rtp`, `buyFeature.cost` and this table. Every paytable combination can land in both weight tables (`missingCombosAnywhere`, `tests/games/crystal.test.ts`).

## Dev
`?game=crystal&force=feature` — every base spin triggers free spins; `&force=anticipation` — prism tease; `&seed=n` reproducible.
