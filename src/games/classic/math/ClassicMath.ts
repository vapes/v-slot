import { assetUrl, toSpinResult, type MathModel, type SpinResult } from '@/engine';
import { config, PAYOUT_PROBABILITIES } from '../config';
import { PrecomputedTable } from './PrecomputedTable';

/**
 * Precomputed-screen math: picks a payout category by config.payoutDistribution,
 * then a random grid of that category from screens.bin (tools/generate-screens.mjs).
 */
export class ClassicMath implements MathModel {
  private table = new PrecomputedTable(config, PAYOUT_PROBABILITIES);

  async load(): Promise<void> {
    await this.table.load(assetUrl(config.id, 'screens.bin'));
  }

  /** First screen: a real losing screen from screens.bin (category 0 = lose). */
  initialGrid(): string[][] | undefined {
    return this.table.pickFromCategory(0) ?? undefined;
  }

  spin(): SpinResult {
    const grid = this.table.pickGrid();
    if (!grid) throw new Error('PrecomputedTable is not ready');
    return toSpinResult(config, grid);
  }
}
