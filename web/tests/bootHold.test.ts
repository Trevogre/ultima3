import { describe, it, expect } from 'vitest';
import { BOOT_HOLD_MS, holdFor, type Hold } from '../src/ui/bootHold.ts';

/** A hold with `left` ms to run, a tap before it or not, and a press arriving after `pressAt` ms (or never). */
function hold(left: number, tapped = false, pressAt: number | null = null) {
  const waited: number[] = [];
  const h: Hold = {
    left: () => left,
    tapped: () => tapped,
    wait: (ms) => {
      waited.push(ms);
      return Promise.resolve(pressAt !== null && pressAt < ms ? 'A' : null);
    },
  };
  return { h, waited };
}

describe('the boot screen held before the title', () => {
  it('is up five seconds at least', () => {
    expect(BOOT_HOLD_MS).toBe(5000);
  });

  it('waits out what is left of its time, the loading counted towards it', async () => {
    const { h, waited } = hold(3200);
    expect(await holdFor(h)).toBe('time');
    expect(waited).toEqual([3200]);
  });

  it('ends on a press, which it uses up', async () => {
    const { h } = hold(4000, false, 700);
    expect(await holdFor(h)).toBe('skipped');
  });

  it('ends at once for a click or tap that came while the game loaded', async () => {
    const { h, waited } = hold(4000, true);
    expect(await holdFor(h)).toBe('skipped');
    expect(waited).toEqual([]);
  });

  it('is not held when the game took five seconds or more to load', async () => {
    const { h, waited } = hold(-250);
    expect(await holdFor(h)).toBe('none');
    expect(waited).toEqual([]);
  });
});
