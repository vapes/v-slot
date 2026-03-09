# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Vite, port 3000)
- **Build:** `npm run build` (TypeScript compile + Vite bundle → `dist/`)
- **Preview:** `npm run preview`
- **Type check:** `npx tsc --noEmit`

No test framework is configured.

## Tech Stack

PixiJS v7.3.3, TypeScript 5.3 (strict), Vite 5, ES2020 target. Path alias `@/*` → `src/*`.

## Architecture

5-reel, 3-row slot machine rendered on HTML5 Canvas via PixiJS.

### Module Map

- **`core/Game.ts`** — Main orchestrator: creates Pixi Application, wires ReelController + SlotMath + SpinButton, runs game loop via ticker, manages balance/bet state and UI text.
- **`core/Config.ts`** — All game constants (dimensions, symbol IDs, weights, colors, 20 payline definitions).
- **`core/spinConfig.json`** — All tunable timing parameters: spin animation (bounce, speed, acceleration, blur alpha, scroll distances) and win display (`winAllDelay`, `winLineInterval`). No magic numbers in code.
- **`reels/ReelController.ts`** — Orchestrates 5 reels with staggered start/stop. Manages two display layers: masked `reelLayer` (clipped reel area) and unmasked `winLayer` (win symbols render above mask). Promotes/demotes symbols between layers for win animations. `showWins()` highlights all winning positions; `showWinLine()` highlights a single payline (used during win cycle).
- **`reels/Reel.ts`** — Single reel column. State machine: `Idle → BounceUp → SpinUp → Spinning → BounceDown → Settling → Idle`. Distance-based spinning with symbol recycling — symbols scrolling off top reposition at bottom. Two-zone recycling: blur zone (random symbols at reduced alpha) then target zone (final symbols at full alpha).
- **`math/SlotMath.ts`** — Generates random spin grids using weighted reel strips, evaluates all 20 paylines left-to-right. Static RTP calculation via combinatorial probability.
- **`math/Paytable.ts`** — Payout multipliers for 3/4/5 symbol matches per symbol type.
- **`symbols/Symbol.ts`** — `SlotSymbol` extends Pixi Container. Inner `content` container isolates win animation (scale pulse) from positional transforms during spinning. `startWinAnimation(cycleMs)` drives exactly one sine pulse per `cycleMs` milliseconds, synchronized with the win line cycle timer.
- **`symbols/SymbolFactory.ts`** — Object pool for SlotSymbol instances to avoid GC during spins.
- **`ui/SpinButton.ts`** — Spin button with spacebar shortcut.
- **`ui/BetButton.ts`** — Round ±  bet adjustment buttons placed left/right of the spin button.
- **`utils/Random.ts`** — Weighted random picking based on `SYMBOL_WEIGHTS` from Config.

### Rendering Layer Order

```
Stage
├── ReelController.container (positioned at REEL_OFFSET)
│   ├── Background (dark rounded rect)
│   ├── reelLayer (masked to reel area)
│   │   └── Reel[0..4].symbolContainer (y-scrolled during spin)
│   ├── Reel separators
│   └── winLayer (unmasked, above everything — winning symbols promoted here)
├── SpinButton
├── BetButton (−) / BetButton (+)
└── UI text (statusText | winLabelText + winValueText, lineInfoText, statsRow)
```

### Key Patterns

- **Symbol recycling:** During spin, symbols that pass the bottom edge get repositioned to top with new identity. In the blur zone they get random IDs + reduced alpha; in the target zone they get final result IDs + full alpha.
- **Target placement order:** Targets are placed in reverse during recycling (bottom row first) so they end up in correct positions after `snapToTarget()`.
- **Win animation z-order:** Winning symbols are removed from their reel's symbolContainer and added to the winLayer (above the mask), then demoted back before next spin.
- **Config-driven animation:** All spin timing/easing parameters and win display durations live in `spinConfig.json` — no magic numbers in code.
- **Win cycle:** After spin, `Game.startWinCycle()` first shows all winning symbols for `winAllDelay` ms, then iterates through each `WinResult` via `showWinLine()` every `winLineInterval` ms. The pulse animation is reset on each call to `startWinAnimation(cycleMs)` so it completes exactly one cycle per display window. `stopWinCycle()` is called at the start of each new spin.
- **Two-color inline text:** PixiJS v7 has no rich text. Mixed-color labels (WIN:/value, Balance:/value, Bet:/value) use two separate `Text` objects with x positions computed from measured widths each update.

### PixiJS v7 Limitations

- `BlurFilter` causes darkening even at blur=0. Alpha-based approach is used instead for "blur" symbols during spin.
