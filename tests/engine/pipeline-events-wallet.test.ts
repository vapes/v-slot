import { describe, expect, it, vi } from 'vitest';
import { SpinPipeline, type SpinContext } from '../../src/engine/pipeline/SpinPipeline';
import { GameEvents, gameEvents } from '../../src/engine/core/GameEvents';
import { Wallet } from '../../src/engine/core/Wallet';
import { testConfig } from '../helpers';

const ctx = (): SpinContext => ({
  balance: 100, lineBet: 1, totalBet: 3, turbo: false, quick: false,
  result: null, winAmount: 0, cancelled: false, meta: new Map(),
});

describe('SpinPipeline', () => {
  it('runs pre → server → post in order and supports insertBefore/After', async () => {
    const order: string[] = [];
    const p = new SpinPipeline();
    p.add('post', { name: 'c', execute: () => { order.push('c'); } });
    p.add('pre', { name: 'a', execute: () => { order.push('a'); } });
    p.add('server', { name: 'b', execute: async () => { order.push('b'); } });
    p.insertBefore('c', { name: 'c0', execute: () => { order.push('c0'); } });
    p.insertAfter('a', { name: 'a1', execute: () => { order.push('a1'); } });
    await p.execute(ctx());
    expect(order).toEqual(['a', 'a1', 'b', 'c0', 'c']);
  });

  it('stops after a stage sets ctx.cancelled', async () => {
    const later = vi.fn();
    const p = new SpinPipeline();
    p.add('pre', { name: 'cancel', execute: (c) => { c.cancelled = true; } });
    p.add('post', { name: 'later', execute: later });
    await p.execute(ctx());
    expect(later).not.toHaveBeenCalled();
  });
});

describe('GameEvents', () => {
  it('delivers payloads, unsubscribes and isolates failing listeners', () => {
    const bus = new GameEvents();
    const seen: number[] = [];
    const off = bus.on('reelLand', ({ reel }) => seen.push(reel));
    bus.on('reelLand', () => { throw new Error('boom'); });
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bus.emit('reelLand', { reel: 2 });
    off();
    bus.emit('reelLand', { reel: 3 });
    expect(seen).toEqual([2]);
    // the throwing listener is still subscribed: logged on both emits, never breaking delivery
    expect(err).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });
});

describe('Wallet', () => {
  it('steps the bet within bounds or wraps, and emits events', () => {
    const w = new Wallet(testConfig({ betOptions: [30, 60, 90], defaultBetIndex: 0 }));
    const bets: number[] = [];
    const off = gameEvents.on('betChange', ({ totalBet }) => bets.push(totalBet));
    expect(w.changeBet(-1, false)).toBe(false);
    expect(w.changeBet(1, false)).toBe(true);
    expect(w.lineBet).toBe(20);
    expect(w.changeBet(1, false) && w.changeBet(1, false)).toBe(false);
    expect(w.changeBet(1, true)).toBe(true);
    expect(w.totalBet).toBe(30);
    expect(bets).toEqual([60, 90, 30]);
    off();
  });

  it('knows when a spin is affordable', () => {
    const w = new Wallet(testConfig({ startBalance: 40, betOptions: [30], defaultBetIndex: 0 }));
    expect(w.canAffordSpin).toBe(true);
    w.balance = 10;
    expect(w.canAffordSpin).toBe(false);
  });
});
