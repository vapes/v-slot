import { h } from './jsx';
import type { SymbolId } from '../core/Config';
import { SYMBOLS, PAYLINES } from '../core/Config';
import { Paytable } from '../math/Paytable';
import gameConfig from '../gameConfig.json';

// CSS hex colors (same values as Config SYMBOL_COLORS but as CSS strings)
const SYMBOL_CSS_COLOR: Record<string, string> = {
  V: '#E63946',
  A: '#F4A261',
  P: '#2A9D8F',
  E: '#457B9D',
  S: '#6C757D',
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const STYLES = `
/* ── Info button ─────────────────────────────────────────────────────── */
.pt-info-btn {
  position: fixed;
  bottom: 24px;
  left: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.35);
  color: #fff;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 20px;
  font-style: italic;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  transition: background 0.15s;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.pt-info-btn:hover {
  background: rgba(255,255,255,0.22);
}

/* ── Overlay ─────────────────────────────────────────────────────────── */
.pt-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
  z-index: 500;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.pt-overlay--visible {
  opacity: 1;
  pointer-events: all;
}

/* ── Scrollable panel ────────────────────────────────────────────────── */
.pt-panel {
  width: 100%;
  max-width: 540px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 16px 48px;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* ── Header ──────────────────────────────────────────────────────────── */
.pt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0 14px;
  position: sticky;
  top: 0;
  background: rgba(10, 10, 22, 0.97);
  z-index: 1;
  margin-bottom: 4px;
}
.pt-title {
  color: #FFD700;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 3px;
  text-transform: uppercase;
}
.pt-close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.08);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.pt-close:hover { background: rgba(255,255,255,0.18); }

/* ── Section labels ──────────────────────────────────────────────────── */
.pt-section-label {
  color: rgba(255,255,255,0.38);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  margin: 22px 0 10px;
}

/* ── Symbol cards ────────────────────────────────────────────────────── */
.pt-symbols-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pt-symbol-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 12px 14px;
}
.pt-symbol-badge {
  width: 54px;
  height: 54px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 3px 10px rgba(0,0,0,0.45);
}
.pt-symbol-letter {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 26px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
}
.pt-payouts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pt-chip {
  background: rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 5px 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.pt-match {
  color: rgba(255,255,255,0.45);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
}
.pt-mult {
  color: #FFD700;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  font-weight: bold;
}

/* ── Paylines grid ───────────────────────────────────────────────────── */
.pt-paylines-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 7px;
}
.pt-payline {
  background: rgba(255,255,255,0.05);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 9px;
}
.pt-line-num {
  color: rgba(255,255,255,0.35);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  width: 18px;
  text-align: right;
  flex-shrink: 0;
}
.pt-line-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 2px;
  flex: 1;
}
.pt-cell {
  aspect-ratio: 1;
  border-radius: 2px;
  background: rgba(255,255,255,0.10);
}
.pt-cell--on {
  background: #FFD700;
  box-shadow: 0 0 4px rgba(255,215,0,0.5);
}

/* ── RTP block ───────────────────────────────────────────────────────── */
.pt-rtp-block {
  margin-top: 24px;
  background: rgba(255,215,0,0.08);
  border: 1px solid rgba(255,215,0,0.25);
  border-radius: 14px;
  padding: 20px 16px;
  text-align: center;
}
.pt-rtp-label {
  color: rgba(255,255,255,0.45);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.pt-rtp-value {
  color: #FFD700;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 38px;
  font-weight: bold;
}
.pt-rtp-note {
  color: rgba(255,255,255,0.3);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  margin-top: 6px;
}
`;

function injectStyles(): void {
  if (document.getElementById('pt-styles')) return;
  const style = document.createElement('style');
  style.id = 'pt-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// ─── Components ───────────────────────────────────────────────────────────────

/**
 * <SymbolCard id="V" />
 * Displays a colored symbol badge + three payout chips (3×, 4×, 5×).
 */
function SymbolCard({ id }: { id: SymbolId }): HTMLElement {
  const color = SYMBOL_CSS_COLOR[id];
  const p3 = Paytable.getPayout(id, 3);
  const p4 = Paytable.getPayout(id, 4);
  const p5 = Paytable.getPayout(id, 5);
  return (
    <div class="pt-symbol-card">
      <div class="pt-symbol-badge" style={`background:${color}`}>
        <span class="pt-symbol-letter">{id}</span>
      </div>
      <div class="pt-payouts">
        <div class="pt-chip">
          <span class="pt-match">3×</span>
          <span class="pt-mult">{p3}×</span>
        </div>
        <div class="pt-chip">
          <span class="pt-match">4×</span>
          <span class="pt-mult">{p4}×</span>
        </div>
        <div class="pt-chip">
          <span class="pt-match">5×</span>
          <span class="pt-mult">{p5}×</span>
        </div>
      </div>
    </div>
  );
}

/**
 * <PaylineViz index={0} pattern={[1,1,1,1,1]} />
 * Renders a mini 5×3 grid with the payline path highlighted in gold.
 */
function PaylineViz({ index, pattern }: { index: number; pattern: number[] }): HTMLElement {
  const cells: HTMLElement[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const active = pattern[col] === row;
      cells.push(<div class={active ? 'pt-cell pt-cell--on' : 'pt-cell'} />);
    }
  }
  return (
    <div class="pt-payline">
      <span class="pt-line-num">#{index + 1}</span>
      <div class="pt-line-grid">{cells}</div>
    </div>
  );
}

// ─── PaytableScreen ───────────────────────────────────────────────────────────

export class PaytableScreen {
  private overlay: HTMLElement;
  private _visible = false;

  constructor() {
    injectStyles();

    const rtpPct = Math.round(gameConfig.rtp * 100);

    const symbolCards = SYMBOLS.map(id => <SymbolCard id={id} />);
    const paylineVizs = PAYLINES.map((pat, i) => <PaylineViz index={i} pattern={pat} />);

    this.overlay = (
      <div class="pt-overlay" onClick={(e: MouseEvent) => {
        if (e.target === this.overlay) this.hide();
      }}>
        <div class="pt-panel">
          <div class="pt-header">
            <span class="pt-title">Paytable</span>
            <button class="pt-close" onClick={() => this.hide()}>✕</button>
          </div>

          <p class="pt-section-label">Symbols &amp; Payouts</p>
          <div class="pt-symbols-list">{symbolCards}</div>

          <p class="pt-section-label">Winning Lines (20)</p>
          <div class="pt-paylines-grid">{paylineVizs}</div>

          <div class="pt-rtp-block">
            <div class="pt-rtp-label">Return to Player</div>
            <div class="pt-rtp-value">{rtpPct}%</div>
            <div class="pt-rtp-note">Theoretical RTP over long-term play</div>
          </div>
        </div>
      </div>
    );

    document.body.appendChild(this.overlay);
  }

  show(): void {
    this._visible = true;
    this.overlay.classList.add('pt-overlay--visible');
  }

  hide(): void {
    this._visible = false;
    this.overlay.classList.remove('pt-overlay--visible');
  }

  toggle(): void {
    this._visible ? this.hide() : this.show();
  }
}
