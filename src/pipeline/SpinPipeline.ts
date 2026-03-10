import type { SpinResult } from '../math/SlotMath';

export interface SpinContext {
  balance: number;
  lineBet: number;
  totalBet: number;
  turbo: boolean;
  result: SpinResult | null;
  winAmount: number;
  cancelled: boolean;
  meta: Map<string, unknown>;
}

export interface PipelineStage {
  readonly name: string;
  execute(ctx: SpinContext): Promise<void> | void;
}

export type Phase = 'pre' | 'server' | 'post';

const PHASE_ORDER: Phase[] = ['pre', 'server', 'post'];

const PHASE_LABELS: Record<Phase, string> = {
  pre: 'PRE (before server)',
  server: 'SERVER',
  post: 'POST (after server)',
};

export class SpinPipeline {
  private readonly phases: Record<Phase, PipelineStage[]> = {
    pre: [],
    server: [],
    post: [],
  };

  add(phase: Phase, stage: PipelineStage): this {
    this.phases[phase].push(stage);
    return this;
  }

  private findStage(name: string): { phase: Phase; index: number } | null {
    for (const phase of PHASE_ORDER) {
      const idx = this.phases[phase].findIndex(s => s.name === name);
      if (idx >= 0) return { phase, index: idx };
    }
    return null;
  }

  insertBefore(targetName: string, stage: PipelineStage): this {
    const found = this.findStage(targetName);
    if (!found) throw new Error(`Stage "${targetName}" not found`);
    this.phases[found.phase].splice(found.index, 0, stage);
    return this;
  }

  insertAfter(targetName: string, stage: PipelineStage): this {
    const found = this.findStage(targetName);
    if (!found) throw new Error(`Stage "${targetName}" not found`);
    this.phases[found.phase].splice(found.index + 1, 0, stage);
    return this;
  }

  remove(name: string): this {
    const found = this.findStage(name);
    if (!found) throw new Error(`Stage "${name}" not found`);
    this.phases[found.phase].splice(found.index, 1);
    return this;
  }

  replace(name: string, stage: PipelineStage): this {
    const found = this.findStage(name);
    if (!found) throw new Error(`Stage "${name}" not found`);
    this.phases[found.phase][found.index] = stage;
    return this;
  }

  has(name: string): boolean {
    return this.findStage(name) !== null;
  }

  async execute(ctx: SpinContext): Promise<void> {
    for (const phase of PHASE_ORDER) {
      for (const stage of this.phases[phase]) {
        if (ctx.cancelled) return;
        await stage.execute(ctx);
      }
    }
  }

  describe(): string {
    const lines: string[] = ['═══ SPIN PIPELINE ═══', ''];
    for (const phase of PHASE_ORDER) {
      const stages = this.phases[phase];
      lines.push(`  ${PHASE_LABELS[phase]}`);
      if (stages.length === 0) {
        lines.push('  (empty)');
      } else {
        stages.forEach((s, i) => {
          const prefix = stages.length === 1
            ? '──'
            : i === 0
              ? '┌─'
              : i === stages.length - 1
                ? '└─'
                : '├─';
          lines.push(`  ${prefix} ${i + 1}. ${s.name}`);
        });
      }
      lines.push('');
    }
    return lines.join('\n');
  }
}
