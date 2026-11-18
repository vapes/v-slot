/**
 * Cell ids may carry a numeric value: "mult:25" = symbol "mult" with value 25
 * (e.g. a multiplier orb). The value travels with the cell when it falls in a
 * tumble; config lookups (weights, landing, paytable) use the bare symbol.
 */
const SEP = ':';

/** Bare symbol id of a cell ("mult:25" → "mult"). */
export function cellSymbol(id: string): string {
  const i = id.indexOf(SEP);
  return i < 0 ? id : id.slice(0, i);
}

/** Value of a cell ("mult:25" → 25), or null when it has none. */
export function cellValue(id: string): number | null {
  const i = id.indexOf(SEP);
  if (i < 0) return null;
  const v = Number(id.slice(i + 1));
  return Number.isFinite(v) ? v : null;
}

/** Cell id for a symbol with a value. */
export function withValue(symbol: string, value: number): string {
  return `${symbol}${SEP}${value}`;
}
